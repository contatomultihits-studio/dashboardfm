"use client";

import Image from "next/image";
import { useState } from "react";

/** Quanto a proporção da foto pode fugir da do card e ainda assim preencher (cortando pouco). */
const TOLERANCIA_PROPORCAO = 0.18;

/**
 * Foto otimizada: a Vercel entrega no tamanho do card (WebP), a partir do cache mais próximo.
 * `prioridade` = está entre as primeiras da tela; baixa antes das outras.
 * `ajustar` = se a foto tiver outra proporção (vertical, quadrada, cartaz), mostra ela inteira,
 * com a própria foto desfocada preenchendo o resto do card; se já tiver a proporção do card, preenche.
 */
export function Imagem({
  src,
  alt,
  className,
  largura = 800,
  altura = 450,
  sizes = "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 400px",
  prioridade = false,
  ajustar = false,
}: {
  src: string | null;
  alt: string;
  className: string;
  largura?: number;
  altura?: number;
  sizes?: string;
  prioridade?: boolean;
  ajustar?: boolean;
}) {
  const [inteira, setInteira] = useState(false);
  if (!src) return <div className={`${className} sem-imagem`} role="img" aria-label="Sem imagem">SEM IMAGEM</div>;

  const foto = (
    <Image
      src={src}
      alt={alt}
      className={`${className} ${inteira ? "inteira" : ""}`}
      width={largura}
      height={altura}
      sizes={sizes}
      loading={prioridade ? "eager" : "lazy"}
      fetchPriority={prioridade ? "high" : "auto"}
      onLoad={
        ajustar
          ? (e) => {
              const img = e.currentTarget;
              if (!img.naturalWidth || !img.naturalHeight) return;
              const diferenca = Math.abs(img.naturalWidth / img.naturalHeight / (largura / altura) - 1);
              setInteira(diferenca > TOLERANCIA_PROPORCAO);
            }
          : undefined
      }
    />
  );
  if (!ajustar) return foto;

  return (
    <span className="imagem-moldura" data-ajuste={inteira ? "inteira" : "preenche"}>
      {inteira && (
        <Image src={src} alt="" aria-hidden className="imagem-fundo" width={largura} height={altura} sizes={sizes} loading="lazy" />
      )}
      {foto}
    </span>
  );
}
