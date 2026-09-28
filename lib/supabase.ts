import {createClient} from '@supabase/supabase-js'
import {Database} from '@/types/database.types'
 import process from 'process'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPBASE_URL !
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY !

export const supabase = createClient<Database>(supabaseUrl , supabaseAnonKey)

