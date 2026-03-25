"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SneakerEditFormProps = {
  sneaker: {
    id: string;
    nickname: string;
    brand: string | null;
    model: string | null;
    official_product_name: string | null;
    common_nickname: string | null;
    colorway: string | null;
    sku: string | null;
    size: string | null;
    condition: string | null;
    box_condition: string | null;
  };
};

type FormValues = {
  nickname: string;
  brand: string;
  model: string;
  official_product_name: string;
  common_nickname: string;
  colorway: string;
  sku: string;
  size: string;
  condition: string;
  box_condition: string;
};

const CONDITION_OPTIONS = [
  "",
  "Used",
  "Pre-owned",
  "VNDS",
  "Deadstock",
  "New",
  "New with Box",
] as const;

const BOX_CONDITION_OPTIONS = [
  "",
  "No Box",
  "Poor",
  "Fair",
  "Good",
  "Very Good",
  "Excellent",
] as const;

function toFormValues(
  sneaker: SneakerEditFormProps["sneaker"]
): FormValues {
  return {
    nickname: sneaker.nickname ?? "",
    brand: sneaker.brand ?? "",
    model: sneaker.model ?? "",
    official_product_name: sneaker.official_product_name ?? "",
    common_nickname: sneaker.common_nickname ?? "",
    colorway: sneaker.colorway ?? "",
    sku: sneaker.sku ?? "",
    size: sneaker.size ?? "",
    condition: sneaker.condition ?? "",
    box_condition: sneaker.box_condition ?? "",
  };
}

function TextField({
  label,
  value,
  readOnlyValue,
  isEditing,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  readOnlyValue: string | null | undefined;
  isEditing: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="w-32 shrink-0 text-sm text-slate-500">{label}</div>

      <div className="flex-1 text-right">
        {isEditing ? (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        ) : (
          <div className="text-sm text-slate-700">
            {readOnlyValue && readOnlyValue.trim().length > 0
              ? readOnlyValue
              : "—"}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  readOnlyValue,
  isEditing,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  readOnlyValue: string | null | undefined;
  isEditing: boolean;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="w-32 shrink-0 text-sm text-slate-500">{label}</div>

      <div className="flex-1 text-right">
        {isEditing ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            <option value="">{placeholder}</option>
            {options
              .filter((option) => option !== "")
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>
        ) : (
          <div className="text-sm text-slate-700">
            {readOnlyValue && readOnlyValue.trim().length > 0
              ? readOnlyValue
              : "—"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SneakerEditForm({
  sneaker,
}: SneakerEditFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(() =>
    toFormValues(sneaker)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isRefreshing, startRefreshing] = useTransition();

  const initialValues = useMemo(() => toFormValues(sneaker), [sneaker]);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCancel() {
    setFormValues(initialValues);
    setIsEditing(false);
    setMessage(null);
    setErrorMessage(null);
  }

  function handleSave() {
    setMessage(null);
    setErrorMessage(null);

    startSaving(async () => {
      try {
        const response = await fetch(`/api/sneakers/${sneaker.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formValues),
        });

        const result = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string }
          | null;

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Failed to save sneaker.");
        }

        setMessage("Sneaker details saved.");
        setIsEditing(false);
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to save sneaker."
        );
      }
    });
  }

  function handleRefreshMarketValue() {
    setMessage(null);
    setErrorMessage(null);

    startRefreshing(async () => {
      try {
        const response = await fetch(`/api/sneakers/${sneaker.id}/refresh-value`, {
          method: "POST",
        });

        const result = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string }
          | null;

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Failed to refresh market value.");
        }

        setMessage("Market value refreshed.");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to refresh market value."
        );
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Identity</h3>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setErrorMessage(null);
              setIsEditing(true);
            }}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {message ? (
        <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-2xl bg-white">
        <TextField
          label="Nickname"
          value={formValues.nickname}
          readOnlyValue={formValues.nickname}
          isEditing={isEditing}
          onChange={(value) => updateField("nickname", value)}
          placeholder="Travis Scott Fragment"
        />
        <TextField
          label="Brand"
          value={formValues.brand}
          readOnlyValue={formValues.brand}
          isEditing={isEditing}
          onChange={(value) => updateField("brand", value)}
          placeholder="Nike"
        />
        <TextField
          label="Model"
          value={formValues.model}
          readOnlyValue={formValues.model}
          isEditing={isEditing}
          onChange={(value) => updateField("model", value)}
          placeholder="Dunk Low"
        />
        <TextField
          label="Official name"
          value={formValues.official_product_name}
          readOnlyValue={formValues.official_product_name}
          isEditing={isEditing}
          onChange={(value) => updateField("official_product_name", value)}
          placeholder="Nike SB Dunk Low Pro..."
        />
        <TextField
          label="Common nickname"
          value={formValues.common_nickname}
          readOnlyValue={formValues.common_nickname}
          isEditing={isEditing}
          onChange={(value) => updateField("common_nickname", value)}
          placeholder="Crenshaw Skate Club"
        />
        <TextField
          label="Colorway"
          value={formValues.colorway}
          readOnlyValue={formValues.colorway}
          isEditing={isEditing}
          onChange={(value) => updateField("colorway", value)}
          placeholder="Sail / Blue / Tan"
        />
        <TextField
          label="SKU"
          value={formValues.sku}
          readOnlyValue={formValues.sku}
          isEditing={isEditing}
          onChange={(value) => updateField("sku", value)}
          placeholder="FN4193-100"
        />
        <TextField
          label="Size"
          value={formValues.size}
          readOnlyValue={formValues.size}
          isEditing={isEditing}
          onChange={(value) => updateField("size", value)}
          placeholder="10.5"
        />
        <SelectField
          label="Condition"
          value={formValues.condition}
          readOnlyValue={formValues.condition}
          isEditing={isEditing}
          onChange={(value) => updateField("condition", value)}
          options={CONDITION_OPTIONS}
          placeholder="Select condition"
        />
        <SelectField
          label="Box condition"
          value={formValues.box_condition}
          readOnlyValue={formValues.box_condition}
          isEditing={isEditing}
          onChange={(value) => updateField("box_condition", value)}
          options={BOX_CONDITION_OPTIONS}
          placeholder="Select box condition"
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleRefreshMarketValue}
          disabled={isSaving || isRefreshing}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing Market Value..." : "Refresh Market Value"}
        </button>
      </div>
    </div>
  );
}