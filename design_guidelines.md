{
  "product": {
    "name": "Fişten Excel'e",
    "type": "tek sayfalık üretkenlik aracı / veri işleme dashboard'u",
    "primary_user": "Orta yaşlı, teknik bilgisi düşük muhasebeci (Türkçe arayüz, foolproof)",
    "north_star_action": "Toplu fiş yükle → doğrula/düzelt → Excel'e aktar"
  },
  "brand_personality": {
    "attributes": [
      "güven veren",
      "sakin ve göz yormayan",
      "hız odaklı",
      "hata toleranslı (aptal-korumalı)",
      "kurumsal ama sıcak"
    ],
    "visual_style_fusion": {
      "layout_principle": "Swiss-style net grid + bento kartlar (özetler) + sağ yan panel (Material side sheet mantığı)",
      "surface_style": "soft-elevation (ince gölge) + hafif noise dokusu (çok düşük opaklık)",
      "accent_strategy": "renk sadece durumlar ve birincil aksiyon için; okuma alanları düz/solid"
    }
  },
  "gradient_policy": {
    "rules": {
      "prohibited": [
        "blue-500 to purple-600",
        "purple-500 to pink-500",
        "green-500 to blue-500",
        "red to pink",
        "herhangi koyu/doygun gradient kombinasyonu"
      ],
      "max_viewport_coverage": "<= 20%",
      "never_on": [
        "tablo gövdesi",
        "kart içi okuma alanları",
        "küçük UI öğeleri (<100px)",
        "logo/footer/testimonial"
      ],
      "allowed_usage": [
        "hero/upload bölümünün arka planında çok hafif 2-3 renk",
        "dekoratif overlay (blur blob)"
      ],
      "enforcement": "Gradient alanı 20%’yi geçerse veya okunabilirliği düşürürse solid renge dön."
    }
  },
  "design_tokens": {
    "css_custom_properties": {
      "instructions": "Bu token'lar /app/frontend/src/index.css içindeki :root altına taşınacak şekilde düşünülmeli. HSL değerleri shadcn yapısına uyumlu. (Uygulama açık tema, yüksek kontrast.)",
      "tokens": {
        "--background": "36 33% 98%",
        "--foreground": "222 47% 11%",
        "--card": "0 0% 100%",
        "--card-foreground": "222 47% 11%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "222 47% 11%",
        "--primary": "199 89% 33%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "210 40% 96%",
        "--secondary-foreground": "222 47% 11%",
        "--muted": "210 40% 96%",
        "--muted-foreground": "215 16% 40%",
        "--accent": "174 45% 92%",
        "--accent-foreground": "222 47% 11%",
        "--destructive": "0 72% 51%",
        "--destructive-foreground": "0 0% 100%",
        "--border": "214 32% 91%",
        "--input": "214 32% 91%",
        "--ring": "199 89% 33%",
        "--radius": "0.75rem",
        "--chart-1": "199 89% 33%",
        "--chart-2": "174 55% 36%",
        "--chart-3": "43 96% 56%",
        "--chart-4": "222 47% 35%",
        "--chart-5": "0 72% 51%",
        "--shadow-soft": "0 10px 30px rgba(15, 23, 42, 0.08)",
        "--shadow-tight": "0 6px 16px rgba(15, 23, 42, 0.10)",
        "--focus-ring": "0 0 0 4px rgba(14, 165, 233, 0.25)",
        "--noise-opacity": "0.035"
      }
    },
    "semantic_colors": {
      "status": {
        "queued": {
          "label_tr": "Bekliyor",
          "bg": "bg-slate-100",
          "text": "text-slate-700",
          "icon": "Clock"
        },
        "processing": {
          "label_tr": "İşleniyor",
          "bg": "bg-sky-50",
          "text": "text-sky-800",
          "icon": "Loader2"
        },
        "done": {
          "label_tr": "Tamam",
          "bg": "bg-emerald-50",
          "text": "text-emerald-800",
          "icon": "CheckCircle2"
        },
        "needs_review": {
          "label_tr": "Kontrol Gerekli",
          "bg": "bg-amber-50",
          "text": "text-amber-900",
          "row_highlight": "bg-amber-50/70",
          "row_border": "border-l-4 border-amber-400",
          "icon": "AlertTriangle"
        },
        "error": {
          "label_tr": "Hata",
          "bg": "bg-rose-50",
          "text": "text-rose-800",
          "icon": "XCircle"
        }
      },
      "kdv": {
        "kdv_1": { "accent": "text-emerald-800", "chip": "bg-emerald-50" },
        "kdv_10": { "accent": "text-sky-800", "chip": "bg-sky-50" },
        "kdv_20": { "accent": "text-amber-900", "chip": "bg-amber-50" }
      }
    }
  },
  "typography": {
    "font_pairing": {
      "heading": {
        "name": "Space Grotesk",
        "fallback": "ui-sans-serif, system-ui",
        "usage": "Uygulama başlığı, bölüm başlıkları, kart başlıkları"
      },
      "body": {
        "name": "Figtree",
        "fallback": "ui-sans-serif, system-ui",
        "usage": "Tablo, form alanları, açıklamalar (okunabilir, yumuşak)"
      },
      "mono": {
        "name": "Roboto Mono",
        "usage": "Fiş No, Vergi No gibi sabit genişlikli alanlar (opsiyonel)"
      },
      "google_fonts_import": "@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=Roboto+Mono:wght@400;500&display=swap');"
    },
    "text_size_hierarchy": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs"
    },
    "readability_rules": [
      "Tablo gövdesi minimum text-sm, tercihen md:text-base",
      "Satır yüksekliği: min-h-[44px] (dokunmatik hedef)",
      "Sayısal alanlarda tabular-nums kullan (Tailwind: tabular-nums)"
    ]
  },
  "layout": {
    "grid": {
      "container": "max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8",
      "page_structure": [
        "Üst bar (sticky)",
        "Yükleme bölümü",
        "İşleme bölümü (liste + genel ilerleme)",
        "Sonuçlar (özet kartlar + filtreler + tablo + sağ panel)"
      ],
      "desktop_split": {
        "table": "lg:col-span-8",
        "side_panel": "lg:col-span-4",
        "behavior": "Masaüstünde yan panel sabit; tablette Drawer/Sheet olarak açılır"
      }
    },
    "spacing_system": {
      "principle": "2–3x daha ferah: kartlar arası 24–32px, tablo üstü kontroller 16–20px",
      "recommended": {
        "section_gap": "py-8 md:py-10",
        "card_gap": "gap-4 md:gap-6",
        "control_gap": "gap-2 md:gap-3"
      }
    }
  },
  "components": {
    "component_path": {
      "shadcn_primary": [
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/progress.jsx",
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/label.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/calendar.jsx",
        "/app/frontend/src/components/ui/sonner.jsx"
      ],
      "advanced": {
        "resizable": "/app/frontend/src/components/ui/resizable.jsx",
        "drawer": "/app/frontend/src/components/ui/drawer.jsx",
        "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx"
      }
    },
    "page_level_blocks": {
      "top_bar": {
        "description": "Sticky üst bar: logo/ad + parti özeti + birincil Excel'e Aktar + Ayarlar + Temizle",
        "shadcn": ["button", "dropdown-menu", "separator"],
        "tailwind": "sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
        "data_testids": {
          "export": "export-xlsx-button",
          "settings": "open-settings-button",
          "clear": "clear-batch-button"
        }
      },
      "upload_zone": {
        "description": "Büyük drag&drop alanı + format bilgisi + 100 dosya limiti + seçili dosya sayacı",
        "interaction": [
          "Idle: dashed border",
          "Hover: border-primary + hafif shadow",
          "Drag over: bg-accent/60 + ring",
          "Error: border-destructive + açıklayıcı Türkçe mesaj"
        ],
        "tailwind": "rounded-xl border-2 border-dashed border-border bg-card p-6 md:p-10 shadow-[var(--shadow-soft)]",
        "data_testids": {
          "dropzone": "receipt-upload-dropzone",
          "file-input": "receipt-upload-file-input",
          "start": "start-processing-button"
        }
      },
      "processing_list": {
        "description": "Dosya listesi: her satırda dosya adı, durum rozeti, mini progress/spinner, hata ise Tekrar Dene",
        "shadcn": ["badge", "progress", "button", "scroll-area"],
        "row_height": "min-h-[52px]",
        "data_testids": {
          "overall-progress": "overall-processing-progress",
          "file-row": "receipt-file-row",
          "retry": "receipt-retry-button"
        }
      },
      "results_header": {
        "description": "KDV özet kartları + ay filtresi + mükerrer uyarısı + işlem sonu özeti",
        "shadcn": ["card", "tabs", "badge", "calendar", "popover"],
        "data_testids": {
          "month-filter": "month-filter-control",
          "summary": "batch-summary-text",
          "duplicate-warning": "duplicate-receipt-warning"
        }
      },
      "editable_table": {
        "description": "Inline edit: hücreye tıklayınca Input/Select açılır; satır seçilince sağ panelde fiş görseli",
        "shadcn": ["table", "input", "select", "badge", "tooltip"],
        "table_rules": [
          "Sticky header (desktop)",
          "Zebra satır (çok hafif)",
          "Kontrol gerekli satırlar: amber highlight + sol border",
          "Hata satırları: rose tint + ikon"
        ],
        "data_testids": {
          "table": "results-table",
          "row": "results-table-row",
          "cell": "results-table-cell",
          "inline-input": "inline-edit-input",
          "status-badge": "receipt-status-badge"
        }
      },
      "receipt_side_panel": {
        "description": "Sağ panel: seçili fiş fotoğrafı (zoom), temel alanlar, hızlı düzeltme ipuçları",
        "shadcn": ["sheet", "aspect-ratio", "scroll-area", "separator", "button"],
        "behavior": {
          "desktop": "Sağda sabit panel veya Resizable ile genişlik ayarı",
          "tablet_mobile": "Sheet/Drawer olarak açılır"
        },
        "data_testids": {
          "panel": "receipt-preview-panel",
          "image": "receipt-preview-image",
          "close": "close-receipt-preview"
        }
      },
      "settings_panel": {
        "description": "Gemini model adı değiştirme + KVKK bilgilendirme + varsayılanlara dön",
        "shadcn": ["sheet", "input", "label", "button"],
        "data_testids": {
          "model-input": "gemini-model-input",
          "save": "save-settings-button"
        }
      }
    },
    "button_system": {
      "style": "Professional / Corporate (net, orta radius, yüksek kontrast)",
      "tokens": {
        "radius": "rounded-lg",
        "height": "h-11 md:h-12",
        "padding": "px-4 md:px-5",
        "shadow": "shadow-[var(--shadow-tight)]",
        "press": "active:scale-[0.98]",
        "hover": "hover:bg-primary/90",
        "focus": "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
      },
      "variants": {
        "primary": "Excel'e Aktar",
        "secondary": "Temizle / Yeni Parti",
        "ghost": "Satır işlemleri / küçük aksiyonlar",
        "destructive": "Sil / Parti temizle onayı"
      }
    }
  },
  "micro_interactions_motion": {
    "principles": [
      "Her etkileşimde durum değişimi görünür olmalı (hover, focus, loading)",
      "Animasyonlar kısa: 120–180ms; easing: ease-out",
      "Reduced motion destekle"
    ],
    "recommended_library": {
      "name": "framer-motion",
      "install": "npm i framer-motion",
      "usage": [
        "Upload kartı ve sonuç kartları için hafif giriş animasyonu",
        "Durum rozeti değişiminde crossfade",
        "Yan panel açılışında slide-in"
      ]
    },
    "no_transition_all": true
  },
  "data_density_table_guidelines": {
    "columns": [
      "Tarih",
      "Firma",
      "Vergi No",
      "Fiş No",
      "KDV %1 Matrah",
      "KDV %1",
      "KDV %10 Matrah",
      "KDV %10",
      "KDV %20 Matrah",
      "KDV %20",
      "Toplam",
      "Ödeme Türü",
      "Durum"
    ],
    "inline_edit_rules": [
      "Tek tık: hücre seçimi (outline)",
      "Çift tık veya Enter: edit mod",
      "Esc: iptal",
      "Enter: kaydet",
      "Kaydedilmemiş değişiklik: hücre sağ üstte küçük nokta (•) veya border"
    ],
    "empty_states": {
      "no_upload": "Henüz fiş yüklenmedi. Fişleri sürükleyip bırakın veya tıklayın.",
      "processing": "Fişler işleniyor… Bu ekranı kapatmayın.",
      "no_results": "Sonuç bulunamadı. Filtreleri temizleyin veya yeni parti yükleyin."
    }
  },
  "accessibility": {
    "requirements": [
      "WCAG AA kontrast",
      "Durumlar sadece renkle anlatılmayacak: ikon + metin",
      "Tıklanabilir hedefler min 44px",
      "Tablo satırı seçimi klavye ile mümkün (ok tuşları opsiyonel)"
    ],
    "focus": {
      "rule": "Tüm interaktif öğelerde focus-visible ring zorunlu",
      "token": "var(--focus-ring)"
    },
    "turkish_copy": {
      "tone": "net, kısa, suçlayıcı olmayan",
      "examples": {
        "upload_error": "Dosya yüklenemedi. Lütfen JPG/PNG/HEIC/WEBP deneyin.",
        "limit_error": "En fazla 100 fiş yükleyebilirsiniz.",
        "retry": "Tekrar Dene",
        "needs_review_hint": "Bu fişte tutarsızlık var. Lütfen kontrol edip düzeltin."
      }
    }
  },
  "images": {
    "image_urls": [
      {
        "category": "decorative",
        "description": "Bu uygulama veri-odaklı olduğu için gerçek fotoğraf şart değil. Eğer istenirse upload bölümünde çok hafif bir illüstrasyon/Lottie kullanılabilir.",
        "url": ""
      }
    ],
    "lottie_suggestion": {
      "note": "Stock image araması başarısız oldu; bunun yerine Lottie öner.",
      "use_case": "Upload boş durumu için küçük animasyon (fiş tarama) — dikkat dağıtmayacak",
      "source": "https://lottiefiles.com/search?q=scan%20document"
    }
  },
  "instructions_to_main_agent": [
    "App.css içindeki default CRA stillerini kaldır/etkisizleştir (özellikle .App-header center layout). Uygulama container'ını asla text-align:center yapma.",
    "index.css :root token'larını bu guideline'daki HSL değerleriyle güncelle; açık tema + sky/teal aksan kullan.",
    "Türkçe kopyayı birebir kullan: 'Fişleri buraya sürükle veya tıkla', 'Excel'e Aktar', 'Kontrol Gerekli', 'Tekrar Dene'.",
    "Tablo yoğunluğu için: sticky header + zebra + satır yüksekliği 44–52px + tabular-nums.",
    "Kontrol gerekli satırlar: amber highlight + sol border zorunlu.",
    "Sağ fiş önizleme panelini masaüstünde görünür tut; tablet/mobilde Sheet/Drawer.",
    "Ay filtresi için Calendar + Popover kullan; ay bazlı seçim (gün seçimi değil) UX'i basitleştir.",
    "KDV özet kartlarını 3 adet Card olarak tasarla (%1/%10/%20) ve her birinde Matrah + KDV toplamını göster.",
    "Mükerrer fiş uyarısını sonuçlar üstünde Alert olarak göster; satırda da küçük badge.",
    "Tüm butonlar, inputlar, filtreler, tablo satırları, durum rozetleri ve kritik metinler data-testid içermeli (kebab-case).",
    "Toast için sadece sonner kullan (başarı: 'Excel indirildi', hata: 'Excel oluşturulamadı')."
  ]
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
