import { describe, expect, test } from "bun:test"
import { getPasswordStrength } from "@/lib/password-strength"

describe("password-strength", () => {
  test("weak for short passwords", () => {
    expect(getPasswordStrength("abc")).toBe("weak")
  })

  test("strong for long mixed passwords", () => {
    expect(getPasswordStrength("MyStr0ng!Pass")).toBe("strong")
  })
})