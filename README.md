# Customizable NFT Drop Minting Page

This template allows you to sell NFTs as products in a Shopify store.

It utilizes [Shopify Webhooks](https://shopify.dev/apps/webhooks) to listen for orders and mint NFTs to the wallet address that made the order. The metadata of the NFT is the same as the information on the product!

## Using This Repo

To create your own version of this template, you can use the following steps:

Run this command from the terminal to clone this project and install the required dependencies:

```bash
npx thirdweb create --template shopify-sell-nfts
```

### Setting Up Environment Variables

Create a copy of the `.env.example` file and rename it to `.env`. Then, fill in the values for the following environment variables:

```text
ADMIN_PRIVATE_KEY=xxx
NFT_COLLECTION_ADDRESS=xxx
SHOPIFY_SECRET_KEY=xxx
SHOPIFY_SITE_URL=xxx
SHOPIFY_ACCESS_TOKEN=xxx
```

## Guide

The `index.js` file is a web server that listens for post requests on the `/webhooks/orders/create` route.

Each time a request is sent, the signature verifies that the request came from Shopify using the `SHOPIFY_SECRET_KEY` environment variable.

```js
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
        // ...
```

If the signature is verified, the webhook is processed. The webhook is a JSON object that contains the order information. The order information is used to mint the NFT to the wallet address that made the order.

First, we read the order information from the webhook:

```js
// Create a new client for the specified shop.
const client = new Shopify.Clients.Rest(SHOPIFY_SITE_URL, SHOPIFY_ACCESS_TOKEN);

const shopifyOrderId = req.get("X-Shopify-Order-Id");
const response = await client.get({
  type: DataType.JSON,
  path: `/admin/api/2022-07/orders/${shopifyOrderId}.json`,
});

const itemsPurchased = response.body.order.line_items;
```

To mint the NFTs, we connect to our NFT collection using the TypeScript SDK:

```js
const sdk = ThirdwebSDK.fromPrivateKey(
  // Learn more about securely accessing your private key: https://portal.thirdweb.com/sdk/set-up-the-sdk/securing-your-private-key
  ADMIN_PRIVATE_KEY,
  "goerli"
);

const nftCollection = await sdk.getNFTCollection(NFT_COLLECTION_ADDRESS);
```

Then, we loop through each item purchased and mint the NFT to the wallet address that made the order:

```js
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
```

## Join our Discord!

For any questions or suggestions, join our discord at [https://discord.gg/thirdweb](https://discord.gg/thirdweb).
