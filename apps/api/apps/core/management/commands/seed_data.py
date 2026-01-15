from django.core.management.base import BaseCommand
from apps.core.models import Restaurant, User, RestaurantTable
from apps.menu.models import Category, MenuItem


class Command(BaseCommand):
    help = 'Seed database with test data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # Create restaurant
        restaurant, created = Restaurant.objects.get_or_create(
            slug='demo-restaurant',
            defaults={
                'name': 'Spice Garden',
                'address': '123 Main Street',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'pincode': '400001',
                'phone': '+91 9876543210',
                'email': 'info@spicegarden.com',
                'gstin': '27AABCU9603R1ZM',
                'fssai_number': '12345678901234',
                'currency': 'INR',
                'tax_rate': 5.00,
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created restaurant: {restaurant.name}'))
        else:
            self.stdout.write(f'Restaurant already exists: {restaurant.name}')

        # Create owner user
        owner, created = User.objects.get_or_create(
            email='owner@spicegarden.com',
            defaults={
                'name': 'Restaurant Owner',
                'restaurant': restaurant,
                'role': 'OWNER',
                'is_staff': True,
                'pin': '1234',
            }
        )
        if created:
            owner.set_password('demo123')
            owner.save()
            self.stdout.write(self.style.SUCCESS(f'Created owner: {owner.email}'))
        else:
            self.stdout.write(f'Owner already exists: {owner.email}')

        # Create waiter user
        waiter, created = User.objects.get_or_create(
            email='waiter@spicegarden.com',
            defaults={
                'name': 'Demo Waiter',
                'restaurant': restaurant,
                'role': 'WAITER',
                'pin': '5678',
            }
        )
        if created:
            waiter.set_password('demo123')
            waiter.save()
            self.stdout.write(self.style.SUCCESS(f'Created waiter: {waiter.email}'))
        else:
            self.stdout.write(f'Waiter already exists: {waiter.email}')

        # Create tables
        for i in range(1, 11):
            table, created = RestaurantTable.objects.get_or_create(
                restaurant=restaurant,
                name=f'Table {i}',
                defaults={
                    'capacity': 4,
                    'section': 'Main Hall' if i <= 6 else 'Outdoor',
                    'position_x': (i - 1) % 5 * 100,
                    'position_y': (i - 1) // 5 * 100,
                }
            )
            if created:
                self.stdout.write(f'Created table: {table.name}')

        # Create menu categories
        categories_data = [
            {'name': 'Starters', 'display_order': 1},
            {'name': 'Main Course', 'display_order': 2},
            {'name': 'Breads', 'display_order': 3},
            {'name': 'Rice', 'display_order': 4},
            {'name': 'Beverages', 'display_order': 5},
            {'name': 'Desserts', 'display_order': 6},
        ]

        for cat_data in categories_data:
            category, created = Category.objects.get_or_create(
                restaurant=restaurant,
                name=cat_data['name'],
                defaults={'display_order': cat_data['display_order']}
            )
            if created:
                self.stdout.write(f'Created category: {category.name}')

        # Create menu items
        menu_items_data = [
            # Starters
            {'name': 'Paneer Tikka', 'category': 'Starters', 'base_price': 280, 'food_type': 'VEG'},
            {'name': 'Chicken Tikka', 'category': 'Starters', 'base_price': 320, 'food_type': 'NON_VEG'},
            {'name': 'Veg Spring Roll', 'category': 'Starters', 'base_price': 180, 'food_type': 'VEG'},
            {'name': 'Fish Fingers', 'category': 'Starters', 'base_price': 350, 'food_type': 'NON_VEG'},
            # Main Course
            {'name': 'Paneer Butter Masala', 'category': 'Main Course', 'base_price': 320, 'food_type': 'VEG'},
            {'name': 'Dal Makhani', 'category': 'Main Course', 'base_price': 250, 'food_type': 'VEG'},
            {'name': 'Butter Chicken', 'category': 'Main Course', 'base_price': 380, 'food_type': 'NON_VEG'},
            {'name': 'Mutton Rogan Josh', 'category': 'Main Course', 'base_price': 450, 'food_type': 'NON_VEG'},
            # Breads
            {'name': 'Butter Naan', 'category': 'Breads', 'base_price': 60, 'food_type': 'VEG'},
            {'name': 'Garlic Naan', 'category': 'Breads', 'base_price': 70, 'food_type': 'VEG'},
            {'name': 'Tandoori Roti', 'category': 'Breads', 'base_price': 40, 'food_type': 'VEG'},
            # Rice
            {'name': 'Jeera Rice', 'category': 'Rice', 'base_price': 180, 'food_type': 'VEG'},
            {'name': 'Veg Biryani', 'category': 'Rice', 'base_price': 280, 'food_type': 'VEG'},
            {'name': 'Chicken Biryani', 'category': 'Rice', 'base_price': 350, 'food_type': 'NON_VEG'},
            # Beverages
            {'name': 'Masala Chai', 'category': 'Beverages', 'base_price': 50, 'food_type': 'VEG'},
            {'name': 'Fresh Lime Soda', 'category': 'Beverages', 'base_price': 80, 'food_type': 'VEG'},
            {'name': 'Lassi', 'category': 'Beverages', 'base_price': 100, 'food_type': 'VEG'},
            # Desserts
            {'name': 'Gulab Jamun', 'category': 'Desserts', 'base_price': 120, 'food_type': 'VEG'},
            {'name': 'Rasmalai', 'category': 'Desserts', 'base_price': 150, 'food_type': 'VEG'},
        ]

        for item_data in menu_items_data:
            category = Category.objects.get(restaurant=restaurant, name=item_data['category'])
            item, created = MenuItem.objects.get_or_create(
                restaurant=restaurant,
                name=item_data['name'],
                defaults={
                    'category': category,
                    'base_price': item_data['base_price'],
                    'food_type': item_data['food_type'],
                    'is_available': True,
                }
            )
            if created:
                self.stdout.write(f'Created menu item: {item.name}')

        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully!'))
        self.stdout.write('\nTest credentials:')
        self.stdout.write('  Owner: owner@spicegarden.com / demo123')
        self.stdout.write('  Waiter: waiter@spicegarden.com / demo123')
        self.stdout.write('  Restaurant slug: demo-restaurant')
        self.stdout.write('  PIN login: 1234 (owner) or 5678 (waiter)')
