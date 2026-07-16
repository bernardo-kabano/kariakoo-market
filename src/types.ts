export interface Shop {
  id: string
  name: string
  username: string
  phone: string
  password: string
  image: string
  description: string
  location: string
  category: string
  rating: number
  latitude: number
  longitude: number
  tags: string[]
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
  class: string
  shopId: string
  availability: string
  stock: number
}
