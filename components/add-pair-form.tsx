"use client";

import {
  ChangeEvent,
  FormEvent,
  RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type FormState = {
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
  purchase_source: string;
  purchase_date: string;
  purchase_price: string;
  estimated_value_low: string;
  estimated_value_mid: string;
  estimated_value_high: string;
  notes: string;
};

type PhotoKind = "shoe" | "box" | "label";

type PhotoState = {
  originalFile: File | null;
  compressedFile: File | null;
  previewUrl: string | null;
  uploadedUrl: string | null;
  isCompressing: boolean;
};

type ParsedLabelResult = {
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
};

const initialFormState: FormState = {
  nickname: "",
  brand: "",
  model: "",
  official_product_name: "",
  common_nickname: "",
  colorway: "",
  sku: "",
  size: "",
  condition: "Deadstock",
  box_condition: "Good",
  purchase_source: "",
  purchase_date: "",
  purchase_price: "",
  estimated_value_low: "",
  estimated_value_mid: "",
  estimated_value_high: "",
  notes: "",
};

const emptyPhotoState: PhotoState = {
  originalFile: null,
  compressedFile: null,
  previewUrl: null,
  uploadedUrl: null,
  isCompressing: false,
};

function slugifyFileName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function AddPairForm() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialFormState);

  const [shoePhoto, setShoePhoto] = useState<PhotoState>(emptyPhotoState);
  const [boxPhoto, setBoxPhoto] = useState<PhotoState>(emptyPhotoState);
  const [labelPhoto, setLabelPhoto] = useState<PhotoState>(emptyPhotoState);

  const [isSaving, setIsSaving] = useState(false);
  const [isParsingLabel, setIsParsingLabel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const shoeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const shoeLibraryInputRef = useRef<HTMLInputElement | null>(null);

  const boxCameraInputRef = useRef<HTMLInputElement | null>(null);
  const boxLibraryInputRef = useRef<HTMLInputElement | null>(null);

  const labelCameraInputRef = useRef<HTMLInputElement | null>(null);
  const labelLibraryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      [shoePhoto.previewUrl, boxPhoto.previewUrl, labelPhoto.previewUrl].forEach(
        (url) => {
          if (url) URL.revokeObjectURL(url);
        }
      );
    };
  }, [shoePhoto.previewUrl, boxPhoto.previewUrl, labelPhoto.previewUrl]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getPhotoState(kind: PhotoKind) {
    if (kind === "shoe") return shoePhoto;
    if (kind === "box") return boxPhoto;
    return labelPhoto;
  }

  function setPhotoState(kind: PhotoKind, value: PhotoState) {
    if (kind === "shoe") {
      setShoePhoto(value);
      return;
    }

    if (kind === "box") {
      setBoxPhoto(value);
      return;
    }

    setLabelPhoto(value);
  }

  function clearPhoto(kind: PhotoKind) {
    const current = getPhotoState(kind);

    if (current.previewUrl) {
      URL.revokeObjectURL(current.previewUrl);
    }

    setPhotoState(kind, { ...emptyPhotoState });
  }

  async function handlePhotoSelected(kind: PhotoKind, file: File) {
    setError(null);
    setSuccessMessage(null);

    const current = getPhotoState(kind);
    setPhotoState(kind, { ...current, isCompressing: true });

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file.");
      }

      const compressed = await imageCompression(file, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1800,
        useWebWorker: true,
        initialQuality: 0.82,
      });

      if (current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      const nextPreviewUrl = URL.createObjectURL(compressed);

      setPhotoState(kind, {
        originalFile: file,
        compressedFile: compressed,
        previewUrl: nextPreviewUrl,
        uploadedUrl: null,
        isCompressing: false,
      });
    } catch (err) {
      console.error(err);

      if (current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      setPhotoState(kind, { ...emptyPhotoState });
      setError(err instanceof Error ? err.message : "Failed to process image.");
    }
  }

  async function onFileChange(
    kind: PhotoKind,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    await handlePhotoSelected(kind, file);
    event.target.value = "";
  }

  async function uploadPhotoAndReturnUrl(
    sneakerId: string,
    kind: PhotoKind,
    photo: PhotoState,
    isPrimary: boolean
  ) {
    if (!photo.compressedFile) return null;

    const extension =
      photo.compressedFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const safeBaseName = slugifyFileName(
      form.nickname ||
        form.common_nickname ||
        form.official_product_name ||
        form.sku ||
        "sneaker"
    );

    const filePath = `${sneakerId}/${kind}-${safeBaseName}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("sneaker-photos")
      .upload(filePath, photo.compressedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: photo.compressedFile.type || "image/jpeg",
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("sneaker-photos")
      .getPublicUrl(filePath);

    const imageUrl = publicData.publicUrl;

    const { error: photoInsertError } = await supabase
      .from("sneaker_photos")
      .insert({
        sneaker_id: sneakerId,
        photo_type: kind,
        image_url: imageUrl,
        is_primary: isPrimary,
      });

    if (photoInsertError) {
      throw photoInsertError;
    }

    return imageUrl;
  }

  async function ensureTemporaryLabelUrl() {
    if (labelPhoto.uploadedUrl) {
      return labelPhoto.uploadedUrl;
    }

    if (!labelPhoto.compressedFile) {
      throw new Error("Add a label photo first.");
    }

    const extension =
      labelPhoto.compressedFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const tempPath = `tmp/label-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("sneaker-photos")
      .upload(tempPath, labelPhoto.compressedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: labelPhoto.compressedFile.type || "image/jpeg",
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("sneaker-photos")
      .getPublicUrl(tempPath);

    const imageUrl = publicData.publicUrl;

    setLabelPhoto((prev) => ({
      ...prev,
      uploadedUrl: imageUrl,
    }));

    return imageUrl;
  }

  async function handleReadBoxLabel() {
    try {
      setError(null);
      setSuccessMessage(null);
      setIsParsingLabel(true);

      if (!labelPhoto.compressedFile) {
        throw new Error("Add a label photo first.");
      }

      const imageUrl = await ensureTemporaryLabelUrl();

      const response = await fetch("/api/parse-box-label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to read box label.");
      }

      const parsed = (data.parsed || {}) as ParsedLabelResult;

      setForm((prev) => ({
        ...prev,
        brand: prev.brand || parsed.brand || "",
        model: prev.model || parsed.model || "",
        official_product_name:
          prev.official_product_name || parsed.official_product_name || "",
        common_nickname: prev.common_nickname || parsed.common_nickname || "",
        colorway: prev.colorway || parsed.colorway || "",
        sku: prev.sku || parsed.sku || "",
        size: prev.size || parsed.size || "",
      }));

      setSuccessMessage("Box label read successfully.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to read box label.");
    } finally {
      setIsParsingLabel(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const sneakerPayload = {
        nickname: form.nickname || null,
        brand: form.brand || null,
        model: form.model || null,
        official_product_name: form.official_product_name || null,
        common_nickname: form.common_nickname || null,
        colorway: form.colorway || null,
        sku: form.sku || null,
        size: form.size || null,
        condition: form.condition || null,
        box_condition: form.box_condition || null,
        purchase_source: form.purchase_source || null,
        purchase_date: form.purchase_date || null,
        purchase_price: parseNullableNumber(form.purchase_price),
        estimated_value_low: parseNullableNumber(form.estimated_value_low),
        estimated_value_mid: parseNullableNumber(form.estimated_value_mid),
        estimated_value_high: parseNullableNumber(form.estimated_value_high),
        notes: form.notes || null,
      };

      const response = await fetch("/api/sneakers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sneakerPayload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create sneaker.");
      }

      const sneakerId = data.sneaker?.id ?? data.sneakerId;

      if (!sneakerId) {
        throw new Error(
          "Create sneaker succeeded but no sneaker id was returned."
        );
      }

      if (shoePhoto.compressedFile) {
        await uploadPhotoAndReturnUrl(sneakerId, "shoe", shoePhoto, true);
      }

      if (boxPhoto.compressedFile) {
        await uploadPhotoAndReturnUrl(sneakerId, "box", boxPhoto, false);
      }

      if (labelPhoto.compressedFile) {
        await uploadPhotoAndReturnUrl(sneakerId, "label", labelPhoto, false);
      }

      setSuccessMessage("Pair added successfully.");

      [shoePhoto.previewUrl, boxPhoto.previewUrl, labelPhoto.previewUrl].forEach(
        (url) => {
          if (url) URL.revokeObjectURL(url);
        }
      );

      setForm(initialFormState);
      setShoePhoto({ ...emptyPhotoState });
      setBoxPhoto({ ...emptyPhotoState });
      setLabelPhoto({ ...emptyPhotoState });

      router.push("/collection");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save sneaker.");
    } finally {
      setIsSaving(false);
    }
  }

  const isAnyCompressing =
    shoePhoto.isCompressing || boxPhoto.isCompressing || labelPhoto.isCompressing;

  function renderPhotoUploader({
    title,
    description,
    kind,
    cameraRef,
    libraryRef,
  }: {
    title: string;
    description: string;
    kind: PhotoKind;
    cameraRef: RefObject<HTMLInputElement | null>;
    libraryRef: RefObject<HTMLInputElement | null>;
  }) {
    const photo = getPhotoState(kind);

    return (
      <div className="rounded-3xl border border-neutral-200 p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <p className="mt-1 text-sm text-neutral-700">{description}</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              Take Photo
            </button>

            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Choose From Library
            </button>

            {kind === "label" && (
              <button
                type="button"
                onClick={handleReadBoxLabel}
                disabled={
                  !photo.compressedFile || photo.isCompressing || isParsingLabel
                }
                className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isParsingLabel ? "Reading Label..." : "Read Box Label"}
              </button>
            )}

            {(photo.originalFile || photo.compressedFile) && (
              <button
                type="button"
                onClick={() => clearPhoto(kind)}
                className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Remove Photo
              </button>
            )}
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => onFileChange(kind, event)}
            className="hidden"
          />

          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            onChange={(event) => onFileChange(kind, event)}
            className="hidden"
          />

          {photo.isCompressing && (
            <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
              Compressing image...
            </div>
          )}

          {photo.previewUrl && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
                <img
                  src={photo.previewUrl}
                  alt={`${title} preview`}
                  className="h-auto w-full object-cover"
                />
              </div>

              <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-xs text-neutral-700">
                <div>
                  Original:{" "}
                  {photo.originalFile
                    ? `${(photo.originalFile.size / 1024 / 1024).toFixed(2)} MB`
                    : "--"}
                </div>
                <div>
                  Compressed:{" "}
                  {photo.compressedFile
                    ? `${(photo.compressedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : "--"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm text-neutral-900">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">Add Pair</h2>
          <p className="mt-1 text-sm text-neutral-700">
            On mobile, use the camera buttons to shoot sneaker, box, and label
            photos directly.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="nickname"
              className="mb-1 block text-sm font-medium text-neutral-900"
            >
              Nickname
            </label>
            <input
              id="nickname"
              type="text"
              value={form.nickname}
              onChange={(e) => updateField("nickname", e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
              placeholder="Purple Lobster"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="brand"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Brand
              </label>
              <input
                id="brand"
                type="text"
                value={form.brand}
                onChange={(e) => updateField("brand", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="Nike SB"
              />
            </div>

            <div>
              <label
                htmlFor="model"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Model
              </label>
              <input
                id="model"
                type="text"
                value={form.model}
                onChange={(e) => updateField("model", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="Dunk Low Pro SB"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="official_product_name"
              className="mb-1 block text-sm font-medium text-neutral-900"
            >
              Official Product Name
            </label>
            <input
              id="official_product_name"
              type="text"
              value={form.official_product_name}
              onChange={(e) =>
                updateField("official_product_name", e.target.value)
              }
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
            />
          </div>

          <div>
            <label
              htmlFor="common_nickname"
              className="mb-1 block text-sm font-medium text-neutral-900"
            >
              Common Nickname
            </label>
            <input
              id="common_nickname"
              type="text"
              value={form.common_nickname}
              onChange={(e) => updateField("common_nickname", e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="colorway"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Colorway
              </label>
              <input
                id="colorway"
                type="text"
                value={form.colorway}
                onChange={(e) => updateField("colorway", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
              />
            </div>

            <div>
              <label
                htmlFor="sku"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                SKU
              </label>
              <input
                id="sku"
                type="text"
                value={form.sku}
                onChange={(e) => updateField("sku", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="size"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Size
              </label>
              <input
                id="size"
                type="text"
                inputMode="decimal"
                value={form.size}
                onChange={(e) => updateField("size", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="10.5"
              />
            </div>

            <div>
              <label
                htmlFor="condition"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Condition
              </label>
              <select
                id="condition"
                value={form.condition}
                onChange={(e) => updateField("condition", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500"
              >
                <option value="Deadstock">Deadstock</option>
                <option value="VNDS">VNDS</option>
                <option value="Used">Used</option>
                <option value="Beat">Beat</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="box_condition"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Box Condition
              </label>
              <select
                id="box_condition"
                value={form.box_condition}
                onChange={(e) => updateField("box_condition", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500"
              >
                <option value="Good">Good</option>
                <option value="Damaged">Damaged</option>
                <option value="No Box">No Box</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="purchase_source"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Purchase Source
              </label>
              <input
                id="purchase_source"
                type="text"
                value={form.purchase_source}
                onChange={(e) => updateField("purchase_source", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="eBay, SNKRS, local shop"
              />
            </div>

            <div>
              <label
                htmlFor="purchase_date"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Purchase Date
              </label>
              <input
                id="purchase_date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => updateField("purchase_date", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label
                htmlFor="purchase_price"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Purchase Price
              </label>
              <input
                id="purchase_price"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.purchase_price}
                onChange={(e) => updateField("purchase_price", e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label
                htmlFor="estimated_value_low"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Est. Low
              </label>
              <input
                id="estimated_value_low"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.estimated_value_low}
                onChange={(e) =>
                  updateField("estimated_value_low", e.target.value)
                }
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label
                htmlFor="estimated_value_mid"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Est. Mid
              </label>
              <input
                id="estimated_value_mid"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.estimated_value_mid}
                onChange={(e) =>
                  updateField("estimated_value_mid", e.target.value)
                }
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label
                htmlFor="estimated_value_high"
                className="mb-1 block text-sm font-medium text-neutral-900"
              >
                Est. High
              </label>
              <input
                id="estimated_value_high"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.estimated_value_high}
                onChange={(e) =>
                  updateField("estimated_value_high", e.target.value)
                }
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="mb-1 block text-sm font-medium text-neutral-900"
            >
              Notes
            </label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-500 placeholder:text-neutral-500"
              placeholder="Special details, lace swaps, box damage, provenance, etc."
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm text-neutral-900">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">Photos</h2>
          <p className="mt-1 text-sm text-neutral-700">
            Add the main shoe photo now, and optionally include the box and size
            label.
          </p>
        </div>

        <div className="space-y-4">
          {renderPhotoUploader({
            title: "Primary Shoe Photo",
            description: "Main image for the sneaker card and detail page.",
            kind: "shoe",
            cameraRef: shoeCameraInputRef,
            libraryRef: shoeLibraryInputRef,
          })}

          {renderPhotoUploader({
            title: "Box Photo",
            description: "Optional box shot for condition and packaging details.",
            kind: "box",
            cameraRef: boxCameraInputRef,
            libraryRef: boxLibraryInputRef,
          })}

          {renderPhotoUploader({
            title: "Label Photo",
            description:
              "Optional size tag / SKU label photo. Use Read Box Label to auto-fill fields.",
            kind: "label",
            cameraRef: labelCameraInputRef,
            libraryRef: labelLibraryInputRef,
          })}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSaving || isAnyCompressing || isParsingLabel}
          className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Pair"}
        </button>
      </div>
    </form>
  );
}