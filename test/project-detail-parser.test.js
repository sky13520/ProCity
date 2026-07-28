import test from "node:test";
import assert from "node:assert/strict";
import { parseProjectMarkdown, parseProjectSource } from "../src/index.js";

test("HTML project details include gallery, amenities, pricing and deposit", () => {
  const details = parseProjectSource(`
    <img src="/wp-content/uploads/2026/01/central-300x200.jpg">
    <source srcset="https://mycondopro.ca/wp-content/uploads/2026/01/lobby-600x400.jpg 600w,
      https://mycondopro.ca/wp-content/uploads/2026/01/lobby.jpg 1200w">
    <h2>Property Details</h2><ul><li>Developer: Concord</li><li>Storeys: 46</li></ul>
    <h2>Pricing &amp; Fees</h2><ul><li>Price: $500,000</li><li>Parking: $70,000</li></ul>
    <h2>Deposit Structure</h2><p>5% on signing<br>10% on interim closing</p>
    <h3>Building Amenities</h3><ul><li>Fitness Centre</li><li>Outdoor Pool</li></ul>
    <h2>Current Incentives</h2><p>Free assignment</p>
  `);
  assert.equal(details.images.length, 2);
  assert.equal(details.propertyDetails.Storeys, "46");
  assert.equal(details.pricingFees.Parking, "$70,000");
  assert.match(details.depositStructure, /5% on signing/);
  assert.deepEqual(details.amenities, ["Fitness Centre", "Outdoor Pool"]);
  assert.equal(details.currentIncentives, "Free assignment");
});

test("readable project text includes amenities and structured fields", () => {
  const details = parseProjectMarkdown(`
## Property Details
- Developer: Concord
- Suites: 426
## Pricing & Fees
- Maintenance Fee: $0.65/SF
## Deposit Structure
5% on Signing
10% on Interim Closing
### Building Amenities
- Fitness Centre
- Parcel Storage
## Current Incentives
Free assignment
  `);
  assert.equal(details.propertyDetails.Suites, "426");
  assert.equal(details.pricingFees["Maintenance Fee"], "$0.65/SF");
  assert.deepEqual(details.amenities, ["Fitness Centre", "Parcel Storage"]);
  assert.match(details.depositStructure, /5% on Signing/);
});
