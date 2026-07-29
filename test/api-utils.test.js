import test from "node:test";
import assert from "node:assert/strict";
import {
  isAdmin,
  projectPayload,
  toProject
} from "../functions/_lib/http.js";

test("projectPayload normalizes valid project input", () => {
  const payload = projectPayload({
    title: "  Test Tower ",
    city: "Toronto",
    area: "Downtown",
    address: "1 King St W",
    type: "Condo",
    price: "799000",
    latitude: "43.65",
    longitude: "-79.38",
    featured: true,
    published: false
  });

  assert.equal(payload.title, "Test Tower");
  assert.equal(payload.price, 799000);
  assert.equal(payload.featured, 1);
  assert.equal(payload.published, 0);
});

test("projectPayload rejects invalid coordinates", () => {
  assert.throws(() => projectPayload({
    title: "Test",
    city: "Toronto",
    area: "Downtown",
    address: "1 King St W",
    type: "Condo",
    latitude: 120,
    longitude: -79
  }), /Latitude/);
});

test("administrator bearer token must match configured secret", async () => {
  const request = new Request("https://example.com/api/admin/projects", {
    headers: { Authorization: "Bearer correct-token" }
  });
  assert.equal(await isAdmin(request, { ADMIN_API_TOKEN: "correct-token" }), true);
  assert.equal(await isAdmin(request, { ADMIN_API_TOKEN: "wrong-token" }), false);
});

test("Cloudflare Access email can authorize an administrator", async () => {
  const request = new Request("https://example.com/api/admin/projects", {
    headers: { "Cf-Access-Authenticated-User-Email": "jack@example.com" }
  });
  assert.equal(await isAdmin(request, { ADMIN_EMAILS: "jack@example.com,team@example.com" }), true);
});

test("database rows are mapped to public project objects", () => {
  const project = toProject({
    id: 4,
    title: "Test",
    city: "Markham",
    area: "Unionville",
    address: "1 Main St",
    type: "Condo",
    builder: "Builder",
    price: 650000,
    occupancy: "2029",
    badge: "VIP",
    image_url: "https://example.com/image.jpg",
    description: "Description",
    latitude: 43.8,
    longitude: -79.3,
    featured: 1,
    published: 1
  });
  assert.equal(project.image, "https://example.com/image.jpg");
  assert.equal(project.featured, true);
  assert.equal(project.priceLabel, "From $650K");
});
