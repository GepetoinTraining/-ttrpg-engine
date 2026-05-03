CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`seed` text NOT NULL,
	`primes_json` text NOT NULL,
	`zeta` real NOT NULL,
	`geo_lat` real NOT NULL,
	`geo_lon` real NOT NULL,
	`created_at` text NOT NULL,
	`character_created_log` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `actor_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`action_type` text NOT NULL,
	`outcome_grade` text,
	`demerits` integer DEFAULT 0 NOT NULL,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `actor_goals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `actor_advisors` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`domain` text NOT NULL,
	`counsel_style` text,
	`weight` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `actor_drives` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`drive_type` text NOT NULL,
	`intensity` real NOT NULL,
	`satisfaction` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `actor_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`description` text NOT NULL,
	`horizon` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `adventures` (
	`id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`name` text NOT NULL,
	`world_state_json` text,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `agent_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`agent_type` text NOT NULL,
	`personality` text,
	`speech_patterns` text
);
--> statement-breakpoint
CREATE TABLE `agent_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`memory_type` text NOT NULL,
	`content` text NOT NULL,
	`decay_rate` real DEFAULT 0.1 NOT NULL,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `apprenticeships` (
	`id` text PRIMARY KEY NOT NULL,
	`master_id` text NOT NULL,
	`apprentice_id` text NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`started_day` integer NOT NULL,
	FOREIGN KEY (`master_id`) REFERENCES `craftsmen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`apprentice_id`) REFERENCES `craftsmen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `arcs` (
	`id` text PRIMARY KEY NOT NULL,
	`adventure_id` text NOT NULL,
	`arc_type` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `armies` (
	`id` text PRIMARY KEY NOT NULL,
	`faction_id` text NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`morale` real DEFAULT 50 NOT NULL,
	`supplies` real DEFAULT 100 NOT NULL,
	`readiness` real DEFAULT 50 NOT NULL,
	`region_id` text,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `armor_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`ac_bonus` integer NOT NULL,
	`armor_type` text NOT NULL,
	`stealth_disadvantage` integer DEFAULT false NOT NULL,
	`strength_requirement` integer,
	`don_time_minutes` integer,
	`doff_time_minutes` integer,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `army_units` (
	`id` text PRIMARY KEY NOT NULL,
	`army_id` text NOT NULL,
	`unit_type` text NOT NULL,
	`count` integer NOT NULL,
	`veterancy` text DEFAULT 'green' NOT NULL,
	`equipment_tier` integer DEFAULT 1 NOT NULL,
	`commander_id` text,
	FOREIGN KEY (`army_id`) REFERENCES `armies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `auction_houses` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`settlement_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `trading_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`n` integer NOT NULL,
	`expected_trajectory` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `auth_enrollments` (
	`token` text PRIMARY KEY NOT NULL,
	`requested_id` text NOT NULL,
	`geo_lat` real NOT NULL,
	`geo_lon` real NOT NULL,
	`requested_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`account_type` text NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`interest_rate` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `beats` (
	`id` text PRIMARY KEY NOT NULL,
	`quest_id` text NOT NULL,
	`beat_type` text NOT NULL,
	`trigger` text,
	`consequences_json` text,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`form` text DEFAULT 'codex' NOT NULL,
	`knowledge_entries_json` text,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `buildings` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`condition` text DEFAULT 'good' NOT NULL,
	`owner_id` text,
	`interior_seed` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`culture` text NOT NULL,
	`days_per_year` integer DEFAULT 365 NOT NULL,
	`months_json` text NOT NULL,
	`day_names_json` text,
	`festivals_json` text,
	`epoch_name` text,
	`epoch_year` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`adventure_id` text NOT NULL,
	`play_mode` text NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `caravans` (
	`id` text PRIMARY KEY NOT NULL,
	`edge_id` text NOT NULL,
	`inventory_id` text NOT NULL,
	`transport_type` text NOT NULL,
	`mile` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'en_route' NOT NULL,
	FOREIGN KEY (`edge_id`) REFERENCES `world_edges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `caster_state` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`spellcasting_ability` text NOT NULL,
	`dc` integer NOT NULL,
	`attack_bonus` integer NOT NULL,
	`paradox_level` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_abilities` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`ability` text NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_attunements` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`item_id` text NOT NULL,
	`slot_index` integer NOT NULL,
	`attuned_day` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_carried` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`container_id` text NOT NULL,
	`carry_type` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_certs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`seed` text NOT NULL,
	`primes_json` text NOT NULL,
	`zeta` real NOT NULL,
	`geo_lat` real NOT NULL,
	`geo_lon` real NOT NULL,
	`created_at` text NOT NULL,
	`owner_chain_json` text NOT NULL,
	`character_data_id` text,
	`persona_type` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`class_name` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`subclass` text,
	`hit_die` text NOT NULL,
	`is_starting_class` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`condition` text NOT NULL,
	`severity` integer DEFAULT 1 NOT NULL,
	`source` text,
	`duration_type` text DEFAULT 'indefinite' NOT NULL,
	`duration_remaining` integer,
	`applied_day` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`body_slot` text NOT NULL,
	`item_id` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_feats` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`feat_name` text NOT NULL,
	`source` text,
	`description` text,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_material_mastery` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`knowledge_level` integer DEFAULT 0 NOT NULL,
	`discovered_affixes_json` text DEFAULT '[]' NOT NULL,
	`last_studied_day` integer,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_persona` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`field` text NOT NULL,
	`value` text NOT NULL,
	`ord` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_proficiencies` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_saves` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`ability` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`skill` text NOT NULL,
	`proficiency` text DEFAULT 'none' NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`character_cert_id` text NOT NULL,
	`from_account_id` text NOT NULL,
	`to_account_id` text NOT NULL,
	`initiated_at` text NOT NULL,
	`accepted_at` text,
	`cancelled_at` text,
	`initiate_sig` text NOT NULL,
	`accept_sig` text,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`from_player_id` text NOT NULL,
	`to_player_id` text NOT NULL,
	`sender_challenge_n` integer NOT NULL,
	`sender_trajectory` text NOT NULL,
	`receiver_challenge_n` integer,
	`receiver_trajectory` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`initiated_at` text NOT NULL,
	`completed_at` text,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`from_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text,
	`name` text NOT NULL,
	`race` text NOT NULL,
	`subrace` text,
	`size` text DEFAULT 'medium' NOT NULL,
	`reach` integer DEFAULT 5 NOT NULL,
	`background` text,
	`hp_current` integer NOT NULL,
	`hp_max` integer NOT NULL,
	`temp_hp` integer DEFAULT 0 NOT NULL,
	`hit_dice_used` integer DEFAULT 0 NOT NULL,
	`base_ac` integer DEFAULT 10 NOT NULL,
	`armor_type` text DEFAULT 'none' NOT NULL,
	`shield_equipped` integer DEFAULT false NOT NULL,
	`ac_bonuses_json` text,
	`speed` integer DEFAULT 30 NOT NULL,
	`damage_type` text DEFAULT 'slashing' NOT NULL,
	`resistances_json` text,
	`vulnerabilities_json` text,
	`immunities_json` text,
	`status` text DEFAULT 'active' NOT NULL,
	`conditions_json` text,
	`death_save_successes` integer DEFAULT 0 NOT NULL,
	`death_save_failures` integer DEFAULT 0 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`spellcasting_ability` text,
	`location_type` text DEFAULT 'settlement' NOT NULL,
	`location_id` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `check_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` text NOT NULL,
	`check_type` text NOT NULL,
	`dc` integer NOT NULL,
	`result` text NOT NULL,
	`advantage_state` text,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `child_pool` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`child_data_json` text NOT NULL,
	`generated_day` integer NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clergy` (
	`id` text PRIMARY KEY NOT NULL,
	`temple_id` text NOT NULL,
	`npc_id` text,
	`rank` text NOT NULL,
	`deity_id` text NOT NULL,
	`healing_ability` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`temple_id`) REFERENCES `temples`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deity_id`) REFERENCES `deities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `climate_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`climate` text NOT NULL,
	`season_modifiers_json` text,
	`annual_rainfall_mm` real,
	`rainy_seasons` text,
	`snowfall` integer DEFAULT false NOT NULL,
	`snow_months` text,
	`temp_summer_high` real,
	`temp_winter_low` real,
	`prevailing_wind` text,
	`avg_wind_speed` real,
	`storm_frequency` text,
	`humidity_avg` real,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clockwork_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`scene_type` text NOT NULL,
	`difficulty` text,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `combat_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`turns_json` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `combatants` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`initiative` integer NOT NULL,
	`hp` integer NOT NULL,
	`hp_max` integer NOT NULL,
	`ac` integer NOT NULL,
	`conditions_json` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `commodity_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`base_price` real NOT NULL,
	`unit` text DEFAULT 'unit' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commodity_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`commodity_id` text NOT NULL,
	`settlement_id` text NOT NULL,
	`price` real NOT NULL,
	`supply` real NOT NULL,
	`demand` real NOT NULL,
	FOREIGN KEY (`commodity_id`) REFERENCES `commodity_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `commodity_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`edge_id` text NOT NULL,
	`commodity_id` text NOT NULL,
	`profit_margin` real NOT NULL,
	`active_caravans` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`edge_id`) REFERENCES `world_edges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commodity_id`) REFERENCES `commodity_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companion_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`species` text NOT NULL,
	`body_type` text NOT NULL,
	`size` text NOT NULL,
	`color_primary` text NOT NULL,
	`color_secondary` text,
	`color_variance` text DEFAULT 'medium' NOT NULL,
	`fur_type` text,
	`markings_json` text,
	`tail_type` text,
	`hp` integer NOT NULL,
	`ac` integer NOT NULL,
	`speed` integer NOT NULL,
	`speed_special_json` text,
	`ability_scores_json` text,
	`attacks_json` text,
	`tame_dc` integer NOT NULL,
	`tame_time` text,
	`domesticated` integer DEFAULT false NOT NULL,
	`rideable` integer DEFAULT false NOT NULL,
	`carry_capacity_lbs` real,
	`special_ability` text,
	`breedable` integer DEFAULT false NOT NULL,
	`gestation_days` integer,
	`offspring_count` text,
	`produce_json` text,
	`lifespan_years` integer,
	`monster_catalog_id` text,
	FOREIGN KEY (`monster_catalog_id`) REFERENCES `monster_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companions` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`color_override` text,
	`markings_override` text,
	`hp_current` integer NOT NULL,
	`hp_max` integer NOT NULL,
	`conditions_json` text,
	`mood` text DEFAULT 'content' NOT NULL,
	`bond_level` integer DEFAULT 0 NOT NULL,
	`trained` integer DEFAULT false NOT NULL,
	`trained_commands_json` text,
	`pregnant` integer DEFAULT false NOT NULL,
	`due_at_tick` integer,
	`parent_ids` text,
	`generation` integer DEFAULT 0 NOT NULL,
	`stabled` integer DEFAULT false NOT NULL,
	`stable_location_id` text,
	`born_at_tick` integer,
	FOREIGN KEY (`catalog_id`) REFERENCES `companion_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`villain_id` text NOT NULL,
	`patron_id` text,
	`balance` real DEFAULT 0 NOT NULL,
	`escalation` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`villain_id`) REFERENCES `villains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patron_id`) REFERENCES `patrons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `containers` (
	`id` text PRIMARY KEY NOT NULL,
	`inventory_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`weight_capacity` real NOT NULL,
	`volume_capacity` real NOT NULL,
	`spatial_magic` text DEFAULT 'none' NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`lock_dc` integer DEFAULT 0 NOT NULL,
	`currency_json` text,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `context_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`packet_json` text NOT NULL,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `corridor_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`corridor_id` text NOT NULL,
	`seg_order` integer NOT NULL,
	`scene_type` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`choices_json` text,
	`chosen_path` text,
	FOREIGN KEY (`corridor_id`) REFERENCES `solo_corridors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `craftsmen` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`guild_id` text,
	`trade` text NOT NULL,
	`rank` text DEFAULT 'apprentice' NOT NULL,
	`npc_id` text,
	`recipes_json` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `currency_exchanges` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`rates_json` text NOT NULL,
	`spread` real DEFAULT 0.05 NOT NULL,
	`last_tick_day` integer,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `damage_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` text NOT NULL,
	`damage_type` text NOT NULL,
	`amount` integer NOT NULL,
	`target_state_json` text,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`alignment` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`domains_json` text,
	`portfolio` text,
	`holy_symbol` text
);
--> statement-breakpoint
CREATE TABLE `dice_pools` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`config_json` text NOT NULL,
	`state_json` text NOT NULL,
	`last_refresh_day` integer,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dice_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`world_day` integer NOT NULL,
	`roller_id` text NOT NULL,
	`roll_type` text NOT NULL,
	`result_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `diplomatic_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`faction_a` text NOT NULL,
	`faction_b` text NOT NULL,
	`status` text DEFAULT 'neutral' NOT NULL,
	`standing` real DEFAULT 0 NOT NULL,
	`treaties_json` text,
	`last_changed_day` integer,
	FOREIGN KEY (`faction_a`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`faction_b`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `district_hubs` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`district_type` text NOT NULL,
	`template` text,
	`seed` text,
	`adjacency_json` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `divine_interventions` (
	`id` text PRIMARY KEY NOT NULL,
	`deity_id` text NOT NULL,
	`session_id` text,
	`type` text NOT NULL,
	`trigger` text,
	`magnitude` real NOT NULL,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`deity_id`) REFERENCES `deities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `downtime_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`adventure_id` text NOT NULL,
	`character_id` text NOT NULL,
	`activity_type` text NOT NULL,
	`days_spent` integer DEFAULT 0 NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dungeon_gates` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`overflow_level` real DEFAULT 0 NOT NULL,
	`gate_type` text DEFAULT 'natural' NOT NULL,
	`cleared` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dungeon_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`gate_id` text NOT NULL,
	`depth` integer NOT NULL,
	`room_type` text NOT NULL,
	`encounter_json` text,
	`trap_json` text,
	`puzzle_json` text,
	`loot_json` text,
	`cleared` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`gate_id`) REFERENCES `dungeon_gates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entourage_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`entourage_id` text NOT NULL,
	`condition` text NOT NULL,
	`affects_speed` integer DEFAULT false NOT NULL,
	`speed_modifier` real DEFAULT 1 NOT NULL,
	`source` text,
	`applied_day` integer NOT NULL,
	FOREIGN KEY (`entourage_id`) REFERENCES `entourages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entourage_members` (
	`id` text PRIMARY KEY NOT NULL,
	`entourage_id` text NOT NULL,
	`party_id` text,
	`caravan_id` text,
	`army_id` text,
	`member_type` text NOT NULL,
	`position` text DEFAULT 'center' NOT NULL,
	`joined_day` integer NOT NULL,
	FOREIGN KEY (`entourage_id`) REFERENCES `entourages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`caravan_id`) REFERENCES `caravans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`army_id`) REFERENCES `armies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entourages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`lead_party_id` text NOT NULL,
	`formation_type` text DEFAULT 'column' NOT NULL,
	`status` text DEFAULT 'assembling' NOT NULL,
	`speed_override` real,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`lead_party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `faction_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`faction_a` text NOT NULL,
	`faction_b` text NOT NULL,
	`stance` text DEFAULT 'neutral' NOT NULL,
	`trust` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`faction_a`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`faction_b`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `factions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`treasury` real DEFAULT 0 NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `flywheel_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_cert_id` text NOT NULL,
	`push_kind` text NOT NULL,
	`session_id` text,
	`at_day` integer NOT NULL,
	`end_day` integer,
	`payload_json` text NOT NULL,
	`queued_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE TABLE `followers` (
	`id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`npc_id` text NOT NULL,
	`scope` text DEFAULT 'local' NOT NULL,
	`loyalty` real DEFAULT 50 NOT NULL,
	`combat_participation` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `geological_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`geo_type` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`description` text NOT NULL,
	`color_primary` text NOT NULL,
	`color_secondary` text,
	`color_variance` text,
	`texture` text NOT NULL,
	`luster` text,
	`opacity` text,
	`pattern` text,
	`weathering` text,
	`hardness` real,
	`density` text,
	`brittleness` text,
	`magnetism` integer DEFAULT false NOT NULL,
	`typical_scale` text,
	`height_range` text,
	`rarity` text DEFAULT 'common' NOT NULL,
	`magical` integer DEFAULT false NOT NULL,
	`magic_properties` text,
	`smeltable` integer DEFAULT false NOT NULL,
	`smelt_product` text,
	`smelt_ratio` text,
	`carvable` integer DEFAULT false NOT NULL,
	`building_material` integer DEFAULT false NOT NULL,
	`gem_cuttable` integer DEFAULT false NOT NULL,
	`base_value_gp` real,
	`value_unit` text,
	`crafting_json` text
);
--> statement-breakpoint
CREATE TABLE `gm_profile_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`tone` text,
	`pacing` text,
	`combat_frequency` text,
	`social_frequency` text,
	`mercy_level` text,
	`narration_style` text,
	`rules_strictness` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`faction_id` text,
	`settlement_id` text NOT NULL,
	`guild_type` text NOT NULL,
	`name` text NOT NULL,
	`members` integer DEFAULT 0 NOT NULL,
	`treasury` real DEFAULT 0 NOT NULL,
	`intel_json` text,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `herds` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`species` text NOT NULL,
	`count` integer NOT NULL,
	`breeding_rate` real DEFAULT 0.1 NOT NULL,
	`yield_json` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hook_escalations` (
	`id` text PRIMARY KEY NOT NULL,
	`hook_id` text NOT NULL,
	`urgency` text NOT NULL,
	`reminder_type` text NOT NULL,
	`reminder_description` text,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`hook_id`) REFERENCES `hook_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hook_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`hook` text NOT NULL,
	`staleness` real DEFAULT 0 NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`family_name` text NOT NULL,
	`head_id` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`edge_type` text NOT NULL,
	`name` text,
	`traverse_minutes` integer DEFAULT 5 NOT NULL,
	`danger_level` text DEFAULT 'safe' NOT NULL,
	`bidirectional` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_node_id`) REFERENCES `hub_nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_node_id`) REFERENCES `hub_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_food_state` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`cuisine_region` text NOT NULL,
	`variety` real DEFAULT 0 NOT NULL,
	`morale_modifier` real DEFAULT 0 NOT NULL,
	`fuel_type` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`district_id` text,
	`node_type` text NOT NULL,
	`name` text NOT NULL,
	`building_id` text,
	`owner_id` text,
	`public_access` integer DEFAULT true NOT NULL,
	`operating_hours` text,
	`properties_json` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`district_id`) REFERENCES `district_hubs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_runtime_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hub_runtime_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`actor_cert_id` text NOT NULL,
	`action_json` text NOT NULL,
	`receipt_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hub_runtime_id`) REFERENCES `hub_runtimes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_runtime_state` (
	`hub_runtime_id` text PRIMARY KEY NOT NULL,
	`tick_json` text DEFAULT '[]' NOT NULL,
	`write_kappa_json` text DEFAULT '[]' NOT NULL,
	`write_edge_json` text DEFAULT '[]' NOT NULL,
	`entity_spawn_json` text DEFAULT '[]' NOT NULL,
	`entity_move_json` text DEFAULT '[]' NOT NULL,
	`entity_despawn_json` text DEFAULT '[]' NOT NULL,
	`observe_json` text DEFAULT '[]' NOT NULL,
	`session_json` text DEFAULT '[]' NOT NULL,
	`character_transfer_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`hub_runtime_id`) REFERENCES `hub_runtimes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_runtimes` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`district_ids_json` text,
	`hub_id` text NOT NULL,
	`aperture` text DEFAULT 'A4_HUB' NOT NULL,
	`canonical_head_id` text NOT NULL,
	`active_n` integer DEFAULT 0 NOT NULL,
	`joined_session_ids_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`lease_expires_at` text NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`hub_edge_id` text NOT NULL,
	`npc_id` text,
	`vendor_type` text NOT NULL,
	`inventory_id` text,
	`operating_hours` text,
	`reputation` real DEFAULT 50 NOT NULL,
	FOREIGN KEY (`hub_edge_id`) REFERENCES `hub_edges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `infrastructure_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`shape` text NOT NULL,
	`material_primary` text NOT NULL,
	`material_secondary` text,
	`color_primary` text,
	`color_secondary` text,
	`scale_width` real,
	`scale_height` real,
	`scale_length` real,
	`architectural_style` text,
	`build_requirements_json` text,
	`maintenance_cost_json` text,
	`build_difficulty` text,
	`capacity_json` text,
	`defense_bonus` integer,
	`production_json` text
);
--> statement-breakpoint
CREATE TABLE `inventories` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`location_node_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_enchantments` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`enchantment_bonus` integer DEFAULT 0 NOT NULL,
	`effect_description` text,
	`charges_max` integer,
	`charges_current` integer,
	`recharge_condition` text,
	`cursed` integer DEFAULT false NOT NULL,
	`curse_description` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`rarity` text DEFAULT 'common' NOT NULL,
	`weight` real NOT NULL,
	`volume` real NOT NULL,
	`value_gp` real DEFAULT 0 NOT NULL,
	`stackable` integer DEFAULT false NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`magical` integer DEFAULT false NOT NULL,
	`requires_attunement` integer DEFAULT false NOT NULL,
	`source_type` text DEFAULT 'crafted' NOT NULL,
	`properties_json` text,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jurisdictions` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`region_id` text NOT NULL,
	`jurisdiction_type` text NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kinship_links` (
	`id` text PRIMARY KEY NOT NULL,
	`household_a` text NOT NULL,
	`household_b` text NOT NULL,
	`kinship_type` text NOT NULL,
	`legitimacy` text DEFAULT 'legitimate' NOT NULL,
	FOREIGN KEY (`household_a`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`household_b`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`scope` text NOT NULL,
	`boundary` text,
	`confidence` real DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `knowledge_seeds` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`category` text NOT NULL,
	`activated_day` integer,
	`seed_data_json` text,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`amount` real NOT NULL,
	`world_day` integer NOT NULL,
	`description` text,
	FOREIGN KEY (`account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`tier` text NOT NULL,
	`book_count` integer DEFAULT 0 NOT NULL,
	`research_speed` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`principal` real NOT NULL,
	`interest_rate` real NOT NULL,
	`term_weeks` integer NOT NULL,
	`collateral_type` text,
	`collateral_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `loyalty_events` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`event_type` text NOT NULL,
	`loyalty_delta` real NOT NULL,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `followers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `magic_config` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`magic_level` text NOT NULL,
	`source` text,
	`school_modifiers_json` text,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`inventory_id` text NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`specialization` text,
	`reputation` real DEFAULT 50 NOT NULL,
	`capital` real DEFAULT 100 NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mm_states` (
	`id` text PRIMARY KEY NOT NULL,
	`mm_type` text NOT NULL,
	`node_id` text NOT NULL,
	`layer` integer NOT NULL,
	`cadence` text NOT NULL,
	`pending_potential` real DEFAULT 0 NOT NULL,
	`domain_state_json` text
);
--> statement-breakpoint
CREATE TABLE `monster_actors` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_id` text NOT NULL,
	`species_id` text NOT NULL,
	`leader_id` text NOT NULL,
	`leader_name` text NOT NULL,
	`leader_cr` real NOT NULL,
	`camp_node_id` text NOT NULL,
	`camp_edge_id` text,
	`camp_mile_marker` real,
	`population` integer NOT NULL,
	`carrying_capacity` integer NOT NULL,
	`troops` integer NOT NULL,
	`food_security` real DEFAULT 0.7 NOT NULL,
	`gold` real DEFAULT 0 NOT NULL,
	`last_advancement_grade` text DEFAULT 'partial' NOT NULL,
	`last_action` text DEFAULT 'fortify_camp' NOT NULL,
	`months_established` integer DEFAULT 0 NOT NULL,
	`tenure` integer DEFAULT 0 NOT NULL,
	`gate_id` text,
	`claimed_edge_segments_json` text,
	`danger_radius` real DEFAULT 1 NOT NULL,
	`challenges_survived` integer DEFAULT 0 NOT NULL,
	`raids_conducted` integer DEFAULT 0 NOT NULL,
	`settlements_raided_json` text,
	`adaptations_json` text,
	FOREIGN KEY (`catalog_id`) REFERENCES `monster_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gate_id`) REFERENCES `dungeon_gates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `monster_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`species` text NOT NULL,
	`name` text NOT NULL,
	`cr` real NOT NULL,
	`type` text NOT NULL,
	`size` text DEFAULT 'medium' NOT NULL,
	`alignment` text,
	`hp_formula` text NOT NULL,
	`hp_average` integer NOT NULL,
	`ac` integer NOT NULL,
	`ac_source` text,
	`speed` integer DEFAULT 30 NOT NULL,
	`speed_special_json` text,
	`ability_scores_json` text NOT NULL,
	`saves_json` text,
	`skills_json` text,
	`resistances_json` text,
	`vulnerabilities_json` text,
	`immunities_json` text,
	`condition_immunities_json` text,
	`senses_json` text,
	`languages` text,
	`actions_json` text,
	`trait_json` text,
	`legendary_actions_json` text,
	`lair_actions_json` text,
	`environment` text,
	`xp_reward` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `name_pools` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`culture` text NOT NULL,
	`names_json` text NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `natural_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kingdom` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`species` text,
	`description` text NOT NULL,
	`appearance` text,
	`size` text DEFAULT 'small' NOT NULL,
	`rarity` text DEFAULT 'common' NOT NULL,
	`magical` integer DEFAULT false NOT NULL,
	`sentient` integer DEFAULT false NOT NULL,
	`dangerous` integer DEFAULT false NOT NULL,
	`danger_level` text,
	`edible` integer DEFAULT false NOT NULL,
	`medicinal` integer DEFAULT false NOT NULL,
	`alchemical` integer DEFAULT false NOT NULL,
	`craft_material` integer DEFAULT false NOT NULL,
	`uses_json` text,
	`alchemy_json` text,
	`crafting_json` text,
	`habitat` text,
	`diet_type` text,
	`lifespan` text,
	`monster_catalog_id` text,
	FOREIGN KEY (`monster_catalog_id`) REFERENCES `monster_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `npc_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`npc_id` text NOT NULL,
	`memory_type` text NOT NULL,
	`content` text NOT NULL,
	`sentiment` real DEFAULT 0 NOT NULL,
	`decay` real DEFAULT 0.1 NOT NULL,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `npc_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`npc_id` text NOT NULL,
	`secret` text NOT NULL,
	`reveal_trigger` text,
	`revealed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `npcs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`settlement_id` text,
	`role` text,
	`disposition` text DEFAULT 'neutral' NOT NULL,
	`personality_json` text,
	`services_json` text,
	`agenda_json` text,
	`craft` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pantheons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region_id` text,
	`dominant_id` text,
	`member_deity_ids` text,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dominant_id`) REFERENCES `deities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `paradox_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` text NOT NULL,
	`severity` text NOT NULL,
	`trigger_spell` text,
	`consequences_json` text,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`adventure_id` text,
	`gold` real DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`formation` text,
	`birth_tick` integer NOT NULL,
	`current_tick` integer NOT NULL,
	`starting_location` text,
	`starting_type` text DEFAULT 'safe' NOT NULL,
	`xp_multiplier` real DEFAULT 1 NOT NULL,
	`member_cert_ids_json` text DEFAULT '[]' NOT NULL,
	`founder_cert_id` text,
	`disbanded_at` text
);
--> statement-breakpoint
CREATE TABLE `party_members` (
	`id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`character_id` text NOT NULL,
	`role` text,
	`joined_day` integer,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `party_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`region_id` text NOT NULL,
	`chunk_id` text,
	`edge_id` text,
	`settlement_id` text,
	`hub_node_id` text,
	`dungeon_room_id` text,
	`local_x` real DEFAULT 0 NOT NULL,
	`local_y` real DEFAULT 0 NOT NULL,
	`position_type` text NOT NULL,
	`last_updated_tick` integer NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chunk_id`) REFERENCES `world_chunks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edge_id`) REFERENCES `world_edges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `patrons` (
	`id` text PRIMARY KEY NOT NULL,
	`adventure_id` text NOT NULL,
	`name` text NOT NULL,
	`standing` real DEFAULT 0 NOT NULL,
	`blessings` text,
	`favors_owed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `performers` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`performance_type` text NOT NULL,
	`venue_id` text,
	`patronage` real DEFAULT 0 NOT NULL,
	`cultural_score` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `play_mode_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`mode` text NOT NULL,
	`gm_profile` text NOT NULL,
	`pacing_bias` text DEFAULT 'balanced' NOT NULL,
	`corridor_mode` integer DEFAULT false NOT NULL,
	`auto_advance` integer DEFAULT false NOT NULL,
	`max_scenes_per_session` integer DEFAULT 10 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player_npcs` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`npc_character_id` text NOT NULL,
	`role` text DEFAULT 'follower' NOT NULL,
	`assigned_day` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`npc_character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`adventure_id` text,
	`active_character_id` text,
	`is_dm` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `property_deeds` (
	`id` text PRIMARY KEY NOT NULL,
	`building_id` text,
	`node_id` text,
	`owner_id` text NOT NULL,
	`deed_type` text DEFAULT 'building' NOT NULL,
	FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quests` (
	`id` text PRIMARY KEY NOT NULL,
	`arc_id` text NOT NULL,
	`objective` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`reward_json` text,
	FOREIGN KEY (`arc_id`) REFERENCES `arcs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rabbit_holes` (
	`id` text PRIMARY KEY NOT NULL,
	`arc_id` text NOT NULL,
	`depth` integer DEFAULT 1 NOT NULL,
	`connection_points` text,
	FOREIGN KEY (`arc_id`) REFERENCES `arcs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
	`inputs_json` text NOT NULL,
	`quality_dc` integer DEFAULT 10 NOT NULL,
	`tool_requirements` text,
	`base_slots_per_batch` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `commodity_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `region_ecology` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`abundance` text DEFAULT 'moderate' NOT NULL,
	`population` integer,
	`seasonal_availability` text DEFAULT 'year_round' NOT NULL,
	`peak_season` text,
	`dormant_season` text,
	`biome_preference` text,
	`altitude_range` text,
	`forage_dc` integer,
	`harvest_yield` text,
	`harvest_tool_required` text,
	`local_name` text,
	`notes` text,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_id`) REFERENCES `natural_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `region_geology` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`deposit_type` text NOT NULL,
	`deposit_size` text DEFAULT 'moderate' NOT NULL,
	`depth` text DEFAULT 'surface' NOT NULL,
	`accessibility` text DEFAULT 'accessible' NOT NULL,
	`discovery_dc` integer,
	`extraction_dc` integer,
	`extraction_tool` text,
	`extraction_time` text,
	`yield_per_extraction` text,
	`surface_visible` integer DEFAULT false NOT NULL,
	`visual_prominence` text,
	`landscape_effect` text,
	`depleted` integer DEFAULT false NOT NULL,
	`remaining_estimate` text,
	`local_name` text,
	`notes` text,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_id`) REFERENCES `geological_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `region_influence` (
	`id` text PRIMARY KEY NOT NULL,
	`faction_id` text NOT NULL,
	`region_id` text NOT NULL,
	`influence` real DEFAULT 0 NOT NULL,
	`contested` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `regional_infrastructure` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_id` text NOT NULL,
	`region_id` text,
	`edge_id` text,
	`chunk_id` text,
	`local_x` real,
	`local_y` real,
	`start_x` real,
	`start_y` real,
	`end_x` real,
	`end_y` real,
	`name` text,
	`condition` text DEFAULT 'good' NOT NULL,
	`condition_percent` real DEFAULT 100 NOT NULL,
	`operational` integer DEFAULT true NOT NULL,
	`owner_id` text,
	`owner_type` text,
	`built_by_type` text,
	`built_by_id` text,
	`built_by_name` text,
	`built_at_tick` integer,
	`last_maintained_tick` integer,
	`decay_rate` real DEFAULT 0.01 NOT NULL,
	FOREIGN KEY (`catalog_id`) REFERENCES `infrastructure_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edge_id`) REFERENCES `world_edges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reputation_deltas` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`faction_id` text NOT NULL,
	`base_delta` real NOT NULL,
	`applied_delta` real NOT NULL,
	`reason` text,
	`world_day` integer NOT NULL,
	`applied_at` text NOT NULL,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reputations` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`faction_id` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rumors` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`source` text,
	`reliability` real DEFAULT 0.5 NOT NULL,
	`content` text NOT NULL,
	`expiry_day` integer,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scene_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`card_type` text NOT NULL,
	`title` text,
	`read_aloud` text,
	`choices_json` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schemes` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`plan` text NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`resources_json` text,
	`quarterly_tick` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`client_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`risk_level` text DEFAULT 'routine' NOT NULL,
	`slots_estimated` integer DEFAULT 4 NOT NULL,
	`slots_consumed` integer DEFAULT 0 NOT NULL,
	`created_day` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`tier` text DEFAULT 'basic' NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`adventure_id` text NOT NULL,
	`world_day` integer NOT NULL,
	`timestamp` text,
	`world_mutations_json` text,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settlement_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text,
	`region_id` text,
	`calendar_id` text NOT NULL,
	`date_offset` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`name` text NOT NULL,
	`population` integer DEFAULT 0 NOT NULL,
	`stability` real DEFAULT 50 NOT NULL,
	`hub_seed` text,
	`hub_size` text,
	`hub_topology` text,
	`era` text DEFAULT 'medieval' NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`edge_id` text NOT NULL,
	`company_id` text NOT NULL,
	`mile` real DEFAULT 0 NOT NULL,
	`deadline` integer,
	`cargo_manifest_json` text,
	FOREIGN KEY (`edge_id`) REFERENCES `world_edges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `trading_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `siege_weapons` (
	`id` text PRIMARY KEY NOT NULL,
	`army_id` text NOT NULL,
	`type` text NOT NULL,
	`condition` real DEFAULT 100 NOT NULL,
	`crew_required` integer NOT NULL,
	FOREIGN KEY (`army_id`) REFERENCES `armies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `simulation_depth` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`agriculture` integer DEFAULT true NOT NULL,
	`cooking` integer DEFAULT true NOT NULL,
	`banking` integer DEFAULT true NOT NULL,
	`religion` integer DEFAULT true NOT NULL,
	`entertainment` integer DEFAULT true NOT NULL,
	`lore` integer DEFAULT true NOT NULL,
	`warfare` integer DEFAULT true NOT NULL,
	`water_systems` integer DEFAULT true NOT NULL,
	`extraction` integer DEFAULT true NOT NULL,
	`trading` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `social_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`party_a` text NOT NULL,
	`party_b` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`terms_json` text,
	`world_day` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `solo_corridors` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`current_segment` integer DEFAULT 0 NOT NULL,
	`fork_history_json` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spell_elements` (
	`id` text PRIMARY KEY NOT NULL,
	`spell_id` text NOT NULL,
	`damage_type` text,
	`damage_dice` text,
	`save_type` text,
	`scaling_json` text,
	FOREIGN KEY (`spell_id`) REFERENCES `spells`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spell_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`spell_level` integer NOT NULL,
	`total` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spells` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`school` text NOT NULL,
	`level` integer NOT NULL,
	`range` text NOT NULL,
	`components_json` text,
	`duration` text,
	`description` text,
	`ritual` integer DEFAULT false NOT NULL,
	`concentration` integer DEFAULT false NOT NULL,
	`composition_seed` text,
	`creator_cert_id` text,
	`elements_json` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spells_composition_seed_unique` ON `spells` (`composition_seed`);--> statement-breakpoint
CREATE TABLE `spells_known` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`spell_id` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spell_id`) REFERENCES `spells`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spy_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`faction_id` text NOT NULL,
	`npc_id` text,
	`cover_identity` text,
	`cover_settlement_id` text,
	`skill_mod` integer DEFAULT 0 NOT NULL,
	`detected` integer DEFAULT false NOT NULL,
	`missions_completed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cover_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spy_missions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`mission_type` text NOT NULL,
	`target_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`intel_gathered` text,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `spy_agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `structure_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`material_primary` text NOT NULL,
	`material_secondary` text,
	`roof_style` text DEFAULT 'pitched' NOT NULL,
	`stories` integer DEFAULT 1 NOT NULL,
	`footprint_type` text DEFAULT 'rectangular' NOT NULL,
	`footprint_width` real,
	`footprint_depth` real,
	`height_meters` real,
	`architectural_style` text,
	`color_walls` text,
	`color_roof` text,
	`color_trim` text,
	`has_chimney` integer DEFAULT false NOT NULL,
	`has_balcony` integer DEFAULT false NOT NULL,
	`has_sign` integer DEFAULT false NOT NULL,
	`sign_type` text,
	`window_style` text,
	`door_style` text,
	`decorations_json` text,
	`capacity` integer,
	`storage_units` integer,
	`build_cost_gp` real,
	`monthly_upkeep_gp` real
);
--> statement-breakpoint
CREATE TABLE `temples` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`deity_id` text NOT NULL,
	`size` text NOT NULL,
	`clergy_count` integer DEFAULT 1 NOT NULL,
	`faith_output` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deity_id`) REFERENCES `deities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tick_counter` (
	`id` text PRIMARY KEY NOT NULL,
	`current_world_day` integer DEFAULT 0 NOT NULL,
	`campaign_start_day` integer DEFAULT 0 NOT NULL,
	`last_hourly_tick` integer DEFAULT 0 NOT NULL,
	`last_daily_tick` integer DEFAULT 0 NOT NULL,
	`last_weekly_tick` integer DEFAULT 0 NOT NULL,
	`last_monthly_tick` integer DEFAULT 0 NOT NULL,
	`last_yearly_tick` integer DEFAULT 0 NOT NULL,
	`total_ticks_fired` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tick_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`world_day` integer NOT NULL,
	`cadence` text NOT NULL,
	`mms_ticked` integer DEFAULT 0 NOT NULL,
	`player_ticks` integer DEFAULT 0 NOT NULL,
	`timestamp` text
);
--> statement-breakpoint
CREATE TABLE `titles` (
	`id` text PRIMARY KEY NOT NULL,
	`faction_id` text NOT NULL,
	`rank` text NOT NULL,
	`holder_id` text,
	`succession_rules` text,
	FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tpb_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`world_day` integer NOT NULL,
	`action_type` text NOT NULL,
	`target_id` text,
	`delta_json` text,
	`timestamp` text
);
--> statement-breakpoint
CREATE TABLE `trading_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`hq_id` text NOT NULL,
	`founder_id` text NOT NULL,
	`capital` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`banking_charter` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`hq_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `travel_log` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`route` text NOT NULL,
	`world_day` integer NOT NULL,
	`notes_json` text,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `traversals` (
	`id` text PRIMARY KEY NOT NULL,
	`entourage_id` text,
	`party_id` text,
	`edge_id` text NOT NULL,
	`current_mile` real DEFAULT 0 NOT NULL,
	`direction` text DEFAULT 'forward' NOT NULL,
	`start_day` integer NOT NULL,
	`current_day` integer NOT NULL,
	`effective_speed` real NOT NULL,
	`current_segment_index` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`sites_found_json` text,
	FOREIGN KEY (`entourage_id`) REFERENCES `entourages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edge_id`) REFERENCES `world_edges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`seed` text NOT NULL,
	`primes_json` text NOT NULL,
	`zeta` real NOT NULL,
	`enrolled_at` text NOT NULL,
	`enroll_geo_lat` real NOT NULL,
	`enroll_geo_lon` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_auth_at` text
);
--> statement-breakpoint
CREATE TABLE `vehicle_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`material_primary` text NOT NULL,
	`material_secondary` text,
	`color_primary` text,
	`color_secondary` text,
	`scale_length` real,
	`scale_width` real,
	`scale_height` real,
	`propulsion` text NOT NULL,
	`crew_required` integer DEFAULT 0 NOT NULL,
	`crew_max` integer,
	`speed_mph` real NOT NULL,
	`terrain_compat_json` text NOT NULL,
	`can_traverse_rough` integer DEFAULT false NOT NULL,
	`passenger_capacity` integer DEFAULT 0 NOT NULL,
	`cargo_capacity_lbs` real DEFAULT 0 NOT NULL,
	`hp` integer,
	`ac` integer,
	`weapons_json` text,
	`size` text DEFAULT 'large' NOT NULL,
	`tile_occupancy` integer DEFAULT 1 NOT NULL,
	`purchase_price_gp` real,
	`daily_maintenance_gp` real
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`prestige` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `villains` (
	`id` text PRIMARY KEY NOT NULL,
	`adventure_id` text NOT NULL,
	`name` text NOT NULL,
	`tier` integer DEFAULT 1 NOT NULL,
	`plan` text,
	`weaknesses` text,
	`minions_json` text,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `water_bodies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`water_type` text NOT NULL,
	`color_water` text DEFAULT '#2E5B88' NOT NULL,
	`clarity` text DEFAULT 'clear' NOT NULL,
	`flow_speed` text,
	`flow_direction` text,
	`surface_effect` text,
	`depth` text,
	`salinity` text DEFAULT 'fresh' NOT NULL,
	`temperature` text,
	`drinkable` integer DEFAULT true NOT NULL,
	`magical` integer DEFAULT false NOT NULL,
	`magic_effect` text,
	`fishable` integer DEFAULT false NOT NULL,
	`fish_species_json` text,
	`regions_json` text
);
--> statement-breakpoint
CREATE TABLE `weapon_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`damage_dice` text NOT NULL,
	`damage_type` text NOT NULL,
	`weapon_type` text NOT NULL,
	`properties_json` text,
	`range_normal` integer,
	`range_long` integer,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weather_state` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`climate` text NOT NULL,
	`season` text NOT NULL,
	`temperature` real NOT NULL,
	`severity` real DEFAULT 0 NOT NULL,
	`modifiers_json` text,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wiki_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`world_day` integer NOT NULL,
	`article_type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`depth_of_knowledge` text DEFAULT 'rumor' NOT NULL,
	`supersedes_id` text,
	`observer_id` text
);
--> statement-breakpoint
CREATE TABLE `wiki_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` text NOT NULL,
	`chunk_idx` integer NOT NULL,
	`chunk_text` text NOT NULL,
	`embedding` blob,
	FOREIGN KEY (`article_id`) REFERENCES `wiki_articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wiki_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`link_type` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `wiki_articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `wiki_articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wiki_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `wiki_articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wildlife` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`species` text NOT NULL,
	`catalog_id` text,
	`population` integer NOT NULL,
	`breeding_season` text,
	`migratory` integer DEFAULT false NOT NULL,
	`tameable` integer DEFAULT false NOT NULL,
	`harvestable_json` text,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalog_id`) REFERENCES `monster_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `world_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`edge_id` text,
	`chunk_x` integer NOT NULL,
	`chunk_y` integer NOT NULL,
	`procgen_seed` integer NOT NULL,
	`noise_octaves` integer DEFAULT 4 NOT NULL,
	`noise_amplitude` real DEFAULT 1 NOT NULL,
	`noise_frequency` real DEFAULT 0.02 NOT NULL,
	`noise_lacunarity` real DEFAULT 2 NOT NULL,
	`biome` text NOT NULL,
	`elevation` real DEFAULT 0 NOT NULL,
	`elevation_variance` real DEFAULT 0.1 NOT NULL,
	`has_water` integer DEFAULT false NOT NULL,
	`water_coverage` real,
	`has_delta` integer DEFAULT false NOT NULL,
	`delta_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edge_id`) REFERENCES `world_edges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `world_deltas` (
	`id` text PRIMARY KEY NOT NULL,
	`chunk_id` text NOT NULL,
	`local_x` real NOT NULL,
	`local_y` real NOT NULL,
	`local_z` real,
	`delta_type` text NOT NULL,
	`source_entity_type` text,
	`source_entity_id` text,
	`source_description` text,
	`result_entity_type` text,
	`result_entity_id` text,
	`result_description` text,
	`result_quantity` integer,
	`persistent` integer DEFAULT true NOT NULL,
	`regenerate_after_ticks` integer,
	`caused_by_id` text,
	`caused_by_type` text,
	`cause_action` text,
	`tick` integer NOT NULL,
	`world_day` integer NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `world_chunks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `world_discoveries` (
	`id` text PRIMARY KEY NOT NULL,
	`discovery_type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text,
	`discovered_by_type` text NOT NULL,
	`discovered_by_id` text,
	`discovered_by_name` text NOT NULL,
	`discovered_at_region_id` text,
	`discovered_at_settlement` text,
	`discovered_at_tick` integer NOT NULL,
	`discovered_at_world_day` integer NOT NULL,
	`data_json` text NOT NULL,
	`prerequisites_json` text,
	`lore` text,
	`wiki_visible` integer DEFAULT true NOT NULL,
	`replicable` integer DEFAULT true NOT NULL,
	`replication_requirements` text,
	FOREIGN KEY (`discovered_at_region_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `world_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`edge_type` text NOT NULL,
	`distance_miles` real NOT NULL,
	`terrain` text NOT NULL,
	`bidirectional` integer DEFAULT true NOT NULL,
	`segments_json` text,
	FOREIGN KEY (`source_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `world_regions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `world_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`terrain` text NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`tile_x` integer DEFAULT 0 NOT NULL,
	`tile_y` integer DEFAULT 0 NOT NULL,
	`explored` integer DEFAULT false NOT NULL,
	`has_settlement` integer DEFAULT false NOT NULL,
	`settlement_name` text,
	`biome` text,
	`elevation` real,
	`moisture` real,
	`temperature` real,
	`kappa_json` text,
	`color_ground` text,
	`color_accent` text,
	`color_sky` text,
	`vegetation_density` real DEFAULT 0.5 NOT NULL,
	`moisture_level` real DEFAULT 0.5 NOT NULL,
	`temperature_avg` real,
	`temperature_variance` real,
	`wind_exposure` real DEFAULT 0.3 NOT NULL,
	`area_sq_miles` real,
	`chunk_count_x` integer,
	`chunk_count_y` integer,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'custom' NOT NULL,
	`seed` integer DEFAULT 0 NOT NULL,
	`current_day` integer DEFAULT 1 NOT NULL,
	`created_at` text,
	`last_cron_at` text,
	`party_node_id` text
);
