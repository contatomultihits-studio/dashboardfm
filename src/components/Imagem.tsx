import Image from "next/image";

/**
 * Foto otimizada: a Vercel entrega no tamanho do card (WebP), a partir do cache mais próximo.
 * `prioridade` = está entre as primeiras da tela; baixa antes das outras.
 */
export function Imagem({
  src,
  alt,
  className,
  largura = 800,
  altura = 450,
  sizes = "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 400px",
  prioridade = false,
}: {
  src: string | null;
  alt: string;
  className: string;
  largura?: number;
  altura?: number;
  sizes?: string;
  prioridade?: boolean;
}) {
  if (!src) return <div className={`${className} sem-imagem`} role="img" aria-label="Sem imagem">SEM IMAGEM</div>;
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={largura}
      height={altura}
      sizes={sizes}
      loading={prioridade ? "eager" : "lazy"}
      fetchPriority={prioridade ? "high" : "auto"}
    />
  );
}
