import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "./providers";
import { Nav } from "./components/Nav";

export const metadata: Metadata = {
  title: "AgentMint — iNFT Generator on 0G",
  description:
    "Describe an AI agent, mint it as an on-chain iNFT. Personality lives on 0G Storage, chat runs on 0G Compute.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <div className="app-shell">
            <Nav />
            <main className="app-main">{children}</main>
            <footer className="app-footer">
              <span className="muted">
                AgentMint · 0G Zero Cup ·{" "}
                <a
                  href="https://github.com/0glabs/0g-doc"
                  target="_blank"
                  rel="noreferrer"
                >
                  0G SDKs
                </a>{" "}
                · {new Date().getFullYear()}
              </span>
            </footer>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
