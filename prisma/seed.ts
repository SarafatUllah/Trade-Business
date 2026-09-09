import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: { name: 'Karim Uddin', email: 'owner@example.com', passwordHash }
  })

  const business = await prisma.business.create({
    data: { name: 'Karim Trading', currency: 'BDT' }
  })

  await prisma.membership.create({
    data: { userId: user.id, businessId: business.id, role: 'OWNER' }
  })

  // Dynamic fields: mirrors the spec's own example (truck/mill ledger).
  const weight = await prisma.fieldDefinition.create({
    data: { businessId: business.id, entity: 'TRANSACTION', key: 'weight', label: 'Weight (kg)', type: 'NUMBER', showInTable: true, showInInvoice: true, sortOrder: 0 }
  })
  const rate = await prisma.fieldDefinition.create({
    data: { businessId: business.id, entity: 'TRANSACTION', key: 'rate', label: 'Rate', type: 'CURRENCY', showInTable: true, showInInvoice: true, sortOrder: 1 }
  })
  const truckRent = await prisma.fieldDefinition.create({
    data: { businessId: business.id, entity: 'TRANSACTION', key: 'truck_rent', label: 'Truck Rent', type: 'CURRENCY', showInTable: false, showInInvoice: true, sortOrder: 2 }
  })
  await prisma.fieldDefinition.create({
    data: {
      businessId: business.id, entity: 'TRANSACTION', key: 'gross_amount', label: 'Gross Amount', type: 'FORMULA',
      formula: 'weight * rate', showInTable: true, showInInvoice: true, sortOrder: 3
    }
  })
  await prisma.fieldDefinition.create({
    data: {
      businessId: business.id, entity: 'TRANSACTION', key: 'net_amount', label: 'Net Amount', type: 'FORMULA',
      formula: 'gross_amount - truck_rent', showInTable: true, showInInvoice: true, sortOrder: 4
    }
  })
  await prisma.fieldDefinition.create({
    data: {
      businessId: business.id, entity: 'TRANSACTION', key: 'truck_number', label: 'Truck Number', type: 'TEXT',
      showInTable: true, showInInvoice: true, isFilterable: true, sortOrder: 5
    }
  })

  const party1 = await prisma.party.create({ data: { businessId: business.id, name: 'ABC Mill', phone: '01711000000' } })
  const party2 = await prisma.party.create({ data: { businessId: business.id, name: 'XYZ Mill', phone: '01822000000' } })

  const tx = await prisma.transaction.create({
    data: { businessId: business.id, partyId: party1.id, date: new Date(), description: 'Rice delivery, truck 1' }
  })
  await prisma.customFieldValue.createMany({
    data: [
      { fieldId: weight.id, recordId: tx.id, numberValue: 1000 },
      { fieldId: rate.id, recordId: tx.id, numberValue: 30 },
      { fieldId: truckRent.id, recordId: tx.id, numberValue: 500 }
    ]
  })

  await prisma.payable.create({
    data: {
      businessId: business.id, partyId: party1.id, originalAmount: 150000,
      dueDate: new Date(Date.now() + 6 * 86400000),
      reminders: { create: [{ businessId: business.id, obligationType: 'PAYABLE', daysBefore: 1 }, { businessId: business.id, obligationType: 'PAYABLE', daysBefore: 0 }] }
    }
  })

  await prisma.receivable.create({
    data: {
      businessId: business.id, partyId: party2.id, originalAmount: 400000,
      expectedDate: new Date(Date.now() + 10 * 86400000),
      reminders: { create: [{ businessId: business.id, obligationType: 'RECEIVABLE', daysBefore: 1 }, { businessId: business.id, obligationType: 'RECEIVABLE', daysBefore: 0 }] }
    }
  })

  console.log('Seed complete.')
  console.log('Login with: owner@example.com / password123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
