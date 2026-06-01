import type { Product } from '@/types/database'

export function getPriceByClassification(
  product: Product,
  classification: string | null | undefined
): number {
  switch (classification) {
    case 'distribuidor_drogueria':
    case 'distribuidor_clinica_hospital':
    case 'distribuidor_veterinaria':
      return product.price_distributor || product.sale_price
    case 'drogueria':
      return product.price_drogueria || product.sale_price
    case 'veterinaria':
      return product.price_veterinaria || product.sale_price
    case 'casa_citas':
    case 'clinica':
    case 'eps':
    case 'ips':
    case 'estanco':
    case 'industria':
    case 'motel':
    case 'tienda_medica':
      return product.price_entidad || product.sale_price
    case 'whatsapp':
      return product.price_ecommerce || product.sale_price
    default:
      return product.sale_price
  }
}

export function getPriceListLabel(classification: string | null | undefined): string {
  switch (classification) {
    case 'distribuidor_drogueria':
    case 'distribuidor_clinica_hospital':
    case 'distribuidor_veterinaria':
      return 'Lista Distribuidores'
    case 'drogueria':
      return 'Lista Droguerías'
    case 'veterinaria':
      return 'Lista Veterinarias'
    case 'whatsapp':
      return 'Lista Ecommerce'
    case 'casa_citas':
    case 'clinica':
    case 'eps':
    case 'ips':
    case 'estanco':
    case 'industria':
    case 'motel':
    case 'tienda_medica':
      return 'Lista Entidades'
    default:
      return 'Lista General'
  }
}
