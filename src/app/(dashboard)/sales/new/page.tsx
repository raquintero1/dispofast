import { redirect } from 'next/navigation'

export default function NewSalesOrderRedirect() {
  redirect('/sales/create')
}
