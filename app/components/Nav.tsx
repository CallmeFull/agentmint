"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "../providers";

export function Nav() {
  const { hasProvider, address, isConnecting, connect, shortAddress, chainId, ensureCorrectChain } =
    useWallet();
  const pathname = usePathname();

  const onWrongChain = chainId !== null && chainId !== 16602;

  const navLinks = [
    { href: "/", label: "Mint" },
    { href: "/explore", label: "Explore" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <nav className="app-nav">
      <Link href="/" className="brand" style={{ textDecoration: "none" }}>
        <span className="brand-dot" />
        <span className="brand-name">
          Agent<span className="accent">Mint</span>
        </span>
      </Link>

      <div className="nav-links">
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : ""}
          >
            {l.label}
          </Link>
        ))}

        {!hasProvider ? (
          <span className="pill warn" title="Install MetaMask to mint iNFTs">
            no wallet
          </span>
        ) : address ? (
          <>
            {onWrongChain ? (
              <button className="primary" onClick={ensureCorrectChain}>
                Switch to 0G
              </button>
            ) : (
              <span className="pill accent" title={address}>
                {shortAddress}
              </span>
            )}
            <button className="ghost" onClick={() => (window.location.href = "/")}>
              connected
            </button>
          </>
        ) : (
          <button className="primary" onClick={connect} disabled={isConnecting}>
            {isConnecting ? (
              <>
                <span className="spinner" /> connecting…
              </>
            ) : (
              "Connect Wallet"
            )}
          </button>
        )}
      </div>
    </nav>
  );
}
