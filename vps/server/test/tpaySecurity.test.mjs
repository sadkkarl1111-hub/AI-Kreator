import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTpaySigningCertificateUrl } from "../dist/lib/tpay.js";

test("accepts only the documented Tpay notification certificate URL", () => {
  assert.equal(
    validateTpaySigningCertificateUrl("https://secure.tpay.com/x509/notifications-jws.pem"),
    "https://secure.tpay.com/x509/notifications-jws.pem"
  );
});

test("rejects certificate URLs outside the exact Tpay endpoint", () => {
  const invalidUrls = [
    "https://secure.tpay.com.attacker.example/x509/notifications-jws.pem",
    "https://secure.tpay.com@attacker.example/x509/notifications-jws.pem",
    "https://secure.tpay.com:444/x509/notifications-jws.pem",
    "http://secure.tpay.com/x509/notifications-jws.pem",
    "https://secure.tpay.com/x509/other.pem",
    "https://secure.tpay.com/x509/notifications-jws.pem?redirect=https://attacker.example",
    "https://secure.tpay.com/x509/notifications-jws.pem#fragment",
    "not-a-url",
  ];

  for (const url of invalidUrls) {
    assert.throws(() => validateTpaySigningCertificateUrl(url), /Nieprawidlowy adres certyfikatu/);
  }
});
