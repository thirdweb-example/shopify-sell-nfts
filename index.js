const express = require("express");
const app = express();
const getRawBody = require("raw-body");
const crypto = require("crypto");
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { Shopify, DataType } = require("@shopify/shopify-api");
require("dotenv").config();

const {
  ADMIN_PRIVATE_KEY,
  NFT_COLLECTION_ADDRESS,
  SHOPIFY_SECRET_KEY,
  SHOPIFY_SITE_URL,
  SHOPIFY_ACCESS_TOKEN,
} = process.env;

// Listen for requests to the /webhooks/orders/create route
app.post("/webhooks/orders/create", async (req, res) => {
  console.log("Order event received!");

  // Below, we're verifying the webhook was sent from Shopify and not a potential attacker
  // Learn more here: https://shopify.dev/apps/webhooks/configuration/https#step-5-verify-the-webhook
  const hmac = req.get("X-Shopify-Hmac-Sha256");
  const body = await getRawBody(req);
  const hash = crypto
    .createHmac("sha256", SHOPIFY_SECRET_KEY)
    .update(body, "utf8", "hex")
    .digest("base64");

  // Compare our hash to Shopify's hash
  if (hash === hmac) {
    // Create a new client for the specified shop.
    const client = new Shopify.Clients.Rest(
      SHOPIFY_SITE_URL,
      SHOPIFY_ACCESS_TOKEN
    );

    const shopifyOrderId = req.get("X-Shopify-Order-Id");
    const response = await client.get({
      type: DataType.JSON,
      path: `/admin/api/2022-07/orders/${shopifyOrderId}.json`,
    });

    const itemsPurchased = response.body.order.line_items;

    const sdk = ThirdwebSDK.fromPrivateKey(
      // Learn more about securely accessing your private key: https://portal.thirdweb.com/sdk/set-up-the-sdk/securing-your-private-key
      ADMIN_PRIVATE_KEY,
      "goerli"
    );

    const nftCollection = await sdk.getNFTCollection(NFT_COLLECTION_ADDRESS);

    // For each item purchased, mint the wallet address an NFT
    for (const item of itemsPurchased) {
      // Grab the information of the product ordered
      const productQuery = await client.get({
        type: DataType.JSON,
        path: `/admin/api/2022-07/products/${item.product_id}.json`,
      });

      // Set the metadata for the NFT to the product information
      const metadata = {
        name: productQuery.body.product.title,
        description: productQuery.body.product.body_html,
        image: productQuery.body.product.image.src,
      };

      const walletAddress = item.properties.find(
        (p) => p.name === "Wallet Address"
      ).value;

      // Mint the NFT
      const minted = await nftCollection.mintTo(walletAddress, metadata);

      console.log("Successfully minted NFT!", minted);
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(403);
  }
});

app.listen(3000, () => console.log("Example app listening on port 3000!"));
