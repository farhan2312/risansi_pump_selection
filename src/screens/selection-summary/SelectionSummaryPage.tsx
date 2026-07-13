"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./SelectionSummaryPage.css";
import {
  getSelectionReport,
  type ReportField,
  type SelectionReport,
} from "../../services/recommendationService";

type FinalSelections = Record<string, string>;

const fieldKey = (sectionIndex: number, fieldIndex: number) =>
  `${sectionIndex}-${fieldIndex}`;

const SelectionSummaryPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recommendationId = searchParams?.get("recommendationId") ?? undefined;

  const [report, setReport] = useState<SelectionReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalSelections, setFinalSelections] = useState<FinalSelections>({});

  useEffect(() => {
    if (!recommendationId) {
      setError("No pump selection was passed to this page.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getSelectionReport(recommendationId)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        const initial: FinalSelections = {};
        data.sections.forEach((section, si) => {
          section.fields.forEach((f, fi) => {
            if (f.available && f.value !== null) {
              initial[fieldKey(si, fi)] = String(f.value);
            }
          });
        });
        setFinalSelections(initial);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the selection report.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [recommendationId]);

  const renderField = (field: ReportField, si: number, fi: number) => {
    const key = fieldKey(si, fi);
    return (
      <tr key={key}>
        <td className="report-label">{field.label}</td>
        <td className="report-rec">
          {field.available ? (
            <>
              {field.value}
              {field.note && <div className="field-note">{field.note}</div>}
            </>
          ) : (
            <>
              <span className="not-available">
                Not available
                {field.note ? ` — ${field.note}` : " — pending master data"}
              </span>
              {field.aiSuggestion && (
                <div className="ai-suggestion">
                  <span className="ai-suggestion-badge">AI Suggestion</span>
                  {field.aiSuggestion}
                </div>
              )}
            </>
          )}
        </td>
        <td className="report-final">
          <input
            type="text"
            value={finalSelections[key] ?? ""}
            disabled={!field.available && !field.aiSuggestion}
            placeholder={
              field.available
                ? ""
                : field.aiSuggestion
                ? "Accept AI suggestion or type your own"
                : "—"
            }
            onChange={(e) =>
              setFinalSelections((prev) => ({
                ...prev,
                [key]: e.target.value,
              }))
            }
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="summary-page">
      <div className="summary-card">
        <h1>Pump Selection Report</h1>
        <p>
          Review the system recommendation for each parameter and record your
          final selection before completing the project.
        </p>

        {isLoading && <p>Loading report...</p>}
        {error && <p className="error-message">{error}</p>}

        {report && (
          <>
            <div className="report-header">
              <span>Pump Model</span>
              <strong>{report.model}</strong>
            </div>

            {report.sections.map((section, si) => (
              <div className="report-section" key={section.title}>
                <h2>{section.title}</h2>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>System Recommendation</th>
                      <th>Final Selection (editable)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.fields.map((field, fi) =>
                      renderField(field, si, fi)
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}

        <div className="summary-buttons">
          <button className="secondary-btn" onClick={() => router.back()}>
            Back
          </button>
          <button className="primary-btn" disabled={!report}>
            Finish Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectionSummaryPage;
