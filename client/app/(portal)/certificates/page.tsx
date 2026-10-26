"use client";

import { useEffect, useState } from "react";
import { Award, Download } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { certificateFileNames, certificateLabels } from "@/lib/certificate-defaults";
import { saveCertificate } from "@/lib/certificate-download";
import type { CertificateAvailability, CertificateType } from "@/lib/types";
import { Button, Notice } from "@/components/ui/form";
import { PageHeading, Panel } from "@/components/portal/PageHeading";

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateAvailability[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<CertificateType | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.getMyCertificates().then(
      (result) => {
        if (cancelled) return;
        setCertificates(result.certificates);
        setMessage(result.message);
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load your certificates.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Pick up a certificate the organisers published while this tab was in the background.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRefreshKey((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  async function download(type: CertificateType) {
    setDownloading(type);
    setError(null);
    try {
      saveCertificate(await api.downloadCertificate(type), certificateFileNames[type]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download the certificate.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <PageHeading eyebrow="Your achievements" title="Certificates">
        Download your InnoTech26 certificate. Certificates open once the organisers release the department round results, and
        go to students who were marked present at the round: a winner certificate for the winning teams, a participation
        certificate for everyone else.
      </PageHeading>

      {error && <Notice tone="error">{error}</Notice>}

      {!certificates && !error && (
        <p role="status" className="text-sm text-muted">Loading your certificates…</p>
      )}

      {certificates && certificates.length === 0 && (
        <Panel title="Nothing to download yet">
          <p className="text-sm text-muted">{message ?? "There is no certificate available for your account yet."}</p>
        </Panel>
      )}

      {certificates && certificates.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {certificates.filter((item) => item.available).map((item) => (
            <Panel key={item.type}>
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-3">
                  <span className="rounded-full bg-accent-50 p-2 text-accent-600">
                    <Award aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-ink">{certificateLabels[item.type]}</h2>
                  </div>
                </div>
                <Button className="self-start" pending={downloading === item.type} onClick={() => void download(item.type)}>
                  {downloading !== item.type && <Download aria-hidden="true" className="size-4" />}
                  Download PDF
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
