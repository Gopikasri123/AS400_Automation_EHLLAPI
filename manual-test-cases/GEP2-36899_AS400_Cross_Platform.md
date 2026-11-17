# GEP2-36899 (cross-platform) | Website order verified in AS400 ORDERS table, IBM i Main Menu option searched on the website

| Field | Value |
|---|---|
| Test case ID | GEP2-36899 (cross-platform variant) |
| Applications | GEP web shop (US QA `https://www.us.qa.eschein.com/en-us`) and IBM i on PUB400 (ACS 5250 green screen, EHLLAPI) |
| Automation | `tests/cross_platform/GEP2-36899_AS400.spec.ts` (web) calling `as400/scenarios/gep_order_check.py` (green screen) |
| Places a real order | Yes, on the GEP QA site |

## Preconditions
- `.env` holds the GEP market and login (or the test data database connection).
- `PUB400_PASSWORD` is set in the environment; PUB400 user, library (`GOPIKAS1`), session and emulator paths are in `as400/config/config.ini`.
- ACS 5250 session saved as `A.hod` (or already open); 64-bit Python with the ACS EHLLAPI bridge.
- The browser runs headed: the QA site blocks headless browsers ("Access Restricted").

## Notes
- The GEP website is not connected to PUB400. Steps 14-15 therefore record the website order in `GOPIKAS1.ORDERS`
  (simulating the back-end feed) and then read it back on the green screen.
- `GOPIKAS1.ORDERS` layout: `ORDER_ID VARCHAR(20) NOT NULL` (primary key), `PRODUCT_ID VARCHAR(30) NOT NULL`,
  `ORDER_STATUS VARCHAR(20)`, `ORDER_DATE DATE`. If the table is missing it is created with this layout.
- Each run places a new order, so its order number is new and step 14 never collides with an earlier row.

## Test data
| Data | Value |
|---|---|
| Product | `marketData.products.bulkOrder` (US: 1127081) |
| Quantity | 50 |
| PO number | 3787329720 |
| ORDERS.ORDER_ID | Order number shown on the order confirmation page |
| ORDERS.PRODUCT_ID | Same product as above |
| ORDERS.ORDER_STATUS | Status of a new order for the market (`marketData.expectedOrderStatus`, US: Processing), cut to 20 characters |
| ORDERS.ORDER_DATE | Today (local date of the run, YYYY-MM-DD) |
| Main Menu option scraped | 1 (expected text "User tasks") |

## Steps

| Step | Action | Expected result |
|---|---|---|
| 1 | Launch the GEP website and clear the launch popups | Home page is displayed |
| 2 | Sign in | Account menu ("Hi, <name>") is displayed |
| 3 | Clear the cart if it is not empty | Cart is empty |
| 4 | Search the product ID and open its product page | Product page of the product is displayed |
| 5 | Set the quantity to 50 and add the product to the cart | Product is added to the cart |
| 6 | Open the shopping cart | Product is listed in the cart |
| 7 | Proceed to Shipping & Billing | Shipping & Billing page is displayed |
| 8 | Choose the payment method and enter PO number 3787329720 | Payment and PO number are accepted |
| 9 | Review the order | Review Order page is displayed |
| 10 | Submit the order and note the order number | "Your order has been submitted" with an order number |
| 11 | Open My Orders | Submitted Orders tab is displayed |
| 12 | Search the order number in Submitted Orders | The order is listed |
| 13 | AS400: open the ACS session to PUB400, sign on | IBM i Main Menu is displayed |
| 14 | AS400: start STRSQL; `INSERT INTO GOPIKAS1.ORDERS (ORDER_ID, PRODUCT_ID, ORDER_STATUS, ORDER_DATE)` with the website order | "1 rows inserted"; the order number was not in the table before |
| 15 | AS400: `SELECT ORDER_ID, PRODUCT_ID, ORDER_STATUS, CHAR(ORDER_DATE, ISO) FROM GOPIKAS1.ORDERS WHERE ORDER_ID = '<order number>'` on the green screen | Exactly 1 row on the Display Data screen; ORDER_ID, PRODUCT_ID, ORDER_STATUS and ORDER_DATE match the website order |
| 16 | AS400: exit STRSQL, read the text of Main Menu option 1 from the screen, sign off | Option text is read (e.g. "User tasks"); sign-on screen is displayed |
| 17 | Website: type the scraped menu text in the header search bar and search | Search results page shows the searched text (results or a "no results" message) |
| 18 | Post-condition: sign out of the website | Signed out (Gen Z) / browser closed (Gen X, Y) |
