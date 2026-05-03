import React, { useMemo, useState } from "react";
import type { Listing, User } from "../../types";
import "./CreatePage.css";

interface CreatePageProps {
  currentUser?: User;
  onCreate: (listing: Listing) => Promise<void> | void;
}

const AVAILABLE_FEATURES = [
  "Полный доступ",
  "Без VPN",
  "Новый",
  "Автовыдача",
];

const CreatePage: React.FC<CreatePageProps> = ({ currentUser, onCreate }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [imageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedPrice = price.replace(",", ".");
  const parsedPrice = Number(normalizedPrice);
  const isPriceFormatValid =
    normalizedPrice === "" || /^\d*\.?\d{0,9}$/.test(normalizedPrice);
  const isPricePositive =
    isPriceFormatValid &&
    normalizedPrice !== "" &&
    normalizedPrice !== "." &&
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0;

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && isPricePositive;
  }, [isPricePositive, title]);

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((item) => item !== feature)
        : [...prev, feature],
    );
  };

  const handlePriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(",", ".");

    if (value === "" || /^\d*\.?\d{0,9}$/.test(value)) {
      setPrice(value);
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isPricePositive) {
      setError("Недопустимая цена объявления");
      return;
    }

    if (!canSubmit || isSubmitting) {
      return;
    }

    const listing: Listing = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
      currency: "TON",
      features: selectedFeatures,
      seller: currentUser || {
        id: "me",
        username: "me",
        avatar: imageUrl || "",
        rating: 0,
        reviews: 0,
        tenure: "0 дней",
      },
    };

    try {
      setIsSubmitting(true);
      setError(null);
      await onCreate(listing);
      setTitle("");
      setDescription("");
      setPrice("");
      setSelectedFeatures([]);
    } catch (createError) {
      console.error("Create listing error:", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать объявление",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-page">
      <form className="create-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="label">Заголовок</label>
          <input
            className="input"
            placeholder="Название объявления"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">Описание</label>
          <textarea
            className="textarea"
            placeholder="Краткое описание"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">Фильтры</label>
          <div className="filters">
            {AVAILABLE_FEATURES.map((feature) => (
              <button
                type="button"
                key={feature}
                className={`filter-chip ${
                  selectedFeatures.includes(feature) ? "active" : ""
                }`}
                onClick={() => toggleFeature(feature)}
              >
                {feature}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="label">Цена</label>
            <input
              className="input"
              placeholder="0.00"
              inputMode="decimal"
              value={price}
              onChange={handlePriceChange}
            />
          </div>

          <div className="form-group">
            <label className="label">Валюта</label>
            <div className="currency-static">TON</div>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="actions">
          <button
            className="submit-btn"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePage;
