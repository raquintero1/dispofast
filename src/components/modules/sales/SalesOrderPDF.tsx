import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: '#111' },
  row: { flexDirection: 'row' },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  orderTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  orderNumber: { fontSize: 10, color: '#555', marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#1d4ed8', marginVertical: 10 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  label: { color: '#555', marginRight: 4 },
  value: { fontFamily: 'Helvetica-Bold' },
  card: { backgroundColor: '#f8fafc', borderRadius: 4, padding: 8, marginBottom: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1d4ed8', padding: '5 4', borderRadius: 3, marginBottom: 2 },
  tableHeaderText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', padding: '4 4', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  colProduct: { flex: 3 },
  colUnit: { width: 40, textAlign: 'center' },
  colQty: { width: 35, textAlign: 'center' },
  colPrice: { width: 65, textAlign: 'right' },
  colSub: { width: 65, textAlign: 'right' },
  colIva: { width: 55, textAlign: 'right' },
  colTotal: { width: 70, textAlign: 'right' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
  summaryLabel: { width: 130, textAlign: 'right', color: '#555', paddingRight: 8 },
  summaryValue: { width: 90, textAlign: 'right' },
  totalDivider: { borderTopWidth: 1, borderTopColor: '#1d4ed8', marginBottom: 4, marginLeft: 220 },
  footer: { position: 'absolute', bottom: 25, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 6, color: '#888', fontSize: 7.5, flexDirection: 'row', justifyContent: 'space-between' },
})

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export interface SalesOrderPDFData {
  number: string
  date: string
  clientName: string
  clientDocType: string
  clientDoc: string
  clientPhone: string
  clientEmail: string
  clientCity: string
  clientDepartment: string
  deliveryCity: string
  deliveryAddress: string
  classification: string
  paymentConditions: string
  items: Array<{ name: string; unit: string; quantity: number; unitPrice: number; subtotal: number; iva: number; total: number }>
  subtotal: number
  ivaTotal: number
  discountLabel: string
  discountAmount: number
  retefuenteAmount: number
  reteICA: number
  reteICAAmount: number
  flete: number
  total: number
  notes: string
}

export function SalesOrderPDF({ data }: { data: SalesOrderPDFData }) {
  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* HEADER */}
        <View style={S.row}>
          <View style={S.headerLeft}>
            <Text style={S.companyName}>DISPOFAST</Text>
            <Text style={{ color: '#555' }}>Sistema de gestión empresarial</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.orderTitle}>ORDEN DE COMPRA</Text>
            <Text style={S.orderNumber}>{data.number}</Text>
            <Text style={{ color: '#555', marginTop: 2 }}>Fecha: {data.date}</Text>
          </View>
        </View>
        <View style={S.divider} />

        {/* CLIENT + DELIVERY */}
        <View style={[S.row, { gap: 10, marginBottom: 10 }]}>
          <View style={[S.card, { flex: 1 }]}>
            <Text style={S.sectionTitle}>Cliente</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 3 }}>{data.clientName}</Text>
            {data.clientDoc && <View style={S.row}><Text style={S.label}>{data.clientDocType}:</Text><Text style={S.value}>{data.clientDoc}</Text></View>}
            {data.clientPhone && <View style={S.row}><Text style={S.label}>Tel:</Text><Text>{data.clientPhone}</Text></View>}
            {data.clientEmail && <View style={S.row}><Text style={S.label}>Email:</Text><Text>{data.clientEmail}</Text></View>}
            {data.clientCity && <View style={S.row}><Text style={S.label}>Ciudad:</Text><Text>{data.clientCity}, {data.clientDepartment}</Text></View>}
          </View>
          <View style={[S.card, { width: 180 }]}>
            <Text style={S.sectionTitle}>Entrega</Text>
            {data.deliveryCity && <View style={S.row}><Text style={S.label}>Ciudad:</Text><Text style={S.value}>{data.deliveryCity}</Text></View>}
            {data.deliveryAddress && <View style={S.row}><Text style={S.label}>Dirección:</Text><Text>{data.deliveryAddress}</Text></View>}
            <View style={[S.row, { marginTop: 4 }]}><Text style={S.label}>Pago:</Text><Text style={S.value}>{data.paymentConditions}</Text></View>
          </View>
        </View>

        {/* PRODUCTS TABLE */}
        <Text style={[S.sectionTitle, { marginBottom: 4 }]}>Detalle de productos</Text>
        <View style={S.tableHeader}>
          <Text style={[S.tableHeaderText, S.colProduct]}>Producto</Text>
          <Text style={[S.tableHeaderText, S.colUnit]}>Und</Text>
          <Text style={[S.tableHeaderText, S.colQty]}>Cant</Text>
          <Text style={[S.tableHeaderText, S.colPrice]}>V. Unitario</Text>
          <Text style={[S.tableHeaderText, S.colSub]}>Subtotal</Text>
          <Text style={[S.tableHeaderText, S.colIva]}>IVA</Text>
          <Text style={[S.tableHeaderText, S.colTotal]}>Total</Text>
        </View>
        {data.items.map((it, i) => (
          <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={S.colProduct}>{it.name}</Text>
            <Text style={S.colUnit}>{it.unit}</Text>
            <Text style={S.colQty}>{it.quantity}</Text>
            <Text style={S.colPrice}>{fmt(it.unitPrice)}</Text>
            <Text style={S.colSub}>{fmt(it.subtotal)}</Text>
            <Text style={S.colIva}>{fmt(it.iva)}</Text>
            <Text style={[S.colTotal, { fontFamily: 'Helvetica-Bold' }]}>{fmt(it.total)}</Text>
          </View>
        ))}

        {/* PAYMENT SUMMARY */}
        <View style={{ marginTop: 14 }}>
          <View style={S.summaryRow}><Text style={S.summaryLabel}>Subtotal:</Text><Text style={S.summaryValue}>{fmt(data.subtotal)}</Text></View>
          <View style={S.summaryRow}><Text style={S.summaryLabel}>IVA (19%):</Text><Text style={S.summaryValue}>{fmt(data.ivaTotal)}</Text></View>
          {data.discountAmount > 0 && <View style={S.summaryRow}><Text style={[S.summaryLabel, { color: '#dc2626' }]}>Descuento ({data.discountLabel}):</Text><Text style={[S.summaryValue, { color: '#dc2626' }]}>-{fmt(data.discountAmount)}</Text></View>}
          {data.retefuenteAmount > 0 && <View style={S.summaryRow}><Text style={[S.summaryLabel, { color: '#dc2626' }]}>Retefuente (3.5%):</Text><Text style={[S.summaryValue, { color: '#dc2626' }]}>-{fmt(data.retefuenteAmount)}</Text></View>}
          {data.reteICAAmount > 0 && <View style={S.summaryRow}><Text style={[S.summaryLabel, { color: '#dc2626' }]}>ReteICA ({data.reteICA}%):</Text><Text style={[S.summaryValue, { color: '#dc2626' }]}>-{fmt(data.reteICAAmount)}</Text></View>}
          {data.flete > 0 && <View style={S.summaryRow}><Text style={S.summaryLabel}>Flete:</Text><Text style={S.summaryValue}>{fmt(data.flete)}</Text></View>}
          <View style={S.totalDivider} />
          <View style={S.summaryRow}>
            <Text style={[S.summaryLabel, { fontFamily: 'Helvetica-Bold', fontSize: 11 }]}>TOTAL:</Text>
            <Text style={[S.summaryValue, { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#1d4ed8' }]}>{fmt(data.total)}</Text>
          </View>
        </View>

        {data.notes && <View style={[S.card, { marginTop: 10 }]}><Text style={S.sectionTitle}>Notas</Text><Text style={{ color: '#444' }}>{data.notes}</Text></View>}

        <View style={S.footer} fixed>
          <Text>Orden de compra generada por Dispofast</Text>
          <Text>{data.number} · {data.date}</Text>
        </View>
      </Page>
    </Document>
  )
}
