import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await readFile(path.join(process.cwd(), "public", "images", "alfred-avatar-bellhop.png"));

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#f5f1eb",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {/* The background keeps the iPhone home-screen icon opaque. */}
      <img alt="" height={172} src={`data:image/png;base64,${logo.toString("base64")}`} width={172} />
    </div>,
    size,
  );
}
