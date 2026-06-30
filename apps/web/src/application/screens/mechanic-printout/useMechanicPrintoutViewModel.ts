"use client";

import { useEffect, useState } from "react";
import { getMechanicPrintout } from "@/domain/services/reportService";
import { vehicleDisplayName } from "@/domain/types";
import type { MechanicPrintout } from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";

export type PrintoutLoadState = "loading" | "loaded" | "not-found" | "error";

export interface MechanicPrintoutViewModel {
  loadState: PrintoutLoadState;
  printout: MechanicPrintout | null;
  displayName: string;
  generatedDate: string;
}

export function useMechanicPrintoutViewModel(shareToken: string): MechanicPrintoutViewModel {
  const [loadState, setLoadState] = useState<PrintoutLoadState>("loading");
  const [printout, setPrintout] = useState<MechanicPrintout | null>(null);

  useEffect(() => {
    getMechanicPrintout(shareToken)
      .then((data) => {
        if (!data) {
          setLoadState("not-found");
        } else {
          setPrintout(data);
          setLoadState("loaded");
        }
      })
      .catch((err) => {
        logger.error("failed to load mechanic printout", { err });
        setLoadState("error");
      });
  }, [shareToken]);

  const displayName = printout
    ? vehicleDisplayName(printout.vehicle)
    : "Service History";

  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { loadState, printout, displayName, generatedDate };
}
