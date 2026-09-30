/* eslint-disable @next/next/no-img-element */
export function Imagem({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  if (!src) return <div className={`${className} sem-imagem`} role="img" aria-label="Sem imagem">SEM IMAGEM</div>;
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
