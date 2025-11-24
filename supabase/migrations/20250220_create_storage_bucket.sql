-- Create a new storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);

-- Set up security policies for the product-images bucket

-- Allow public read access to product images
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'product-images' );

-- Allow authenticated users to upload images
create policy "Authenticated users can upload images"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'product-images' );

-- Allow authenticated users to update their own images (optional, good for edits)
create policy "Authenticated users can update images"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'product-images' );

-- Allow authenticated users to delete images (optional)
create policy "Authenticated users can delete images"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'product-images' );
