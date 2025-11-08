import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhancedInterestSystem1735689600000 implements MigrationInterface {
  name = 'EnhancedInterestSystem1735689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Add new columns to user_interests table
    await queryRunner.query(`
      ALTER TABLE "user_interests"
      ADD COLUMN IF NOT EXISTS "merged_into_id" uuid,
      ADD COLUMN IF NOT EXISTS "synonyms" text[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT TRUE
    `);

    // Add foreign key for merged_into_id
    await queryRunner.query(`
      ALTER TABLE "user_interests"
      ADD CONSTRAINT "FK_user_interests_merged_into_id"
      FOREIGN KEY ("merged_into_id")
      REFERENCES "user_interests"("id")
      ON DELETE SET NULL
    `);

    // Add indexes for new user_interests columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_interests_merged_into_id"
      ON "user_interests" ("merged_into_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_interests_is_active"
      ON "user_interests" ("is_active")
    `);

    // Create interest_embeddings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interest_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "interest_id" uuid NOT NULL,
        "embedding" vector(4096) NOT NULL,
        "model_version" varchar(50) NOT NULL DEFAULT 'qwen3-embedding-8b',
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_interest_embeddings_interest_id"
          FOREIGN KEY ("interest_id")
          REFERENCES "user_interests"("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_interest_embeddings_interest_id"
          UNIQUE ("interest_id")
      )
    `);

    // Create indexes for interest_embeddings
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_embeddings_interest_id"
      ON "interest_embeddings" ("interest_id")
    `);

    // Note: pgvector 0.8.1 has max 2000 dimensions for indexes
    // For 4096-dimensional embeddings, we'll use brute-force search initially
    // Or consider dimension reduction/chunking in Phase 2
    // await queryRunner.query(`
    //   CREATE INDEX IF NOT EXISTS "IDX_interest_embeddings_vector"
    //   ON "interest_embeddings"
    //   USING hnsw (embedding vector_cosine_ops)
    // `);

    // Create interest_similarities table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interest_similarities" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "interest_1_id" uuid NOT NULL,
        "interest_2_id" uuid NOT NULL,
        "similarity_score" decimal(5, 4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
        "computed_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_interest_similarities_interest_1_id"
          FOREIGN KEY ("interest_1_id")
          REFERENCES "user_interests"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_interest_similarities_interest_2_id"
          FOREIGN KEY ("interest_2_id")
          REFERENCES "user_interests"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_interest_similarities_order"
          CHECK ("interest_1_id" < "interest_2_id"),
        CONSTRAINT "UQ_interest_similarities_pair"
          UNIQUE ("interest_1_id", "interest_2_id")
      )
    `);

    // Create indexes for interest_similarities
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_similarities_interest_1_id"
      ON "interest_similarities" ("interest_1_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_similarities_interest_2_id"
      ON "interest_similarities" ("interest_2_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_similarities_similarity_score"
      ON "interest_similarities" ("similarity_score" DESC)
    `);

    // Create interest_hierarchies table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interest_hierarchies" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "parent_id" uuid NOT NULL,
        "child_id" uuid NOT NULL,
        "hierarchy_type" varchar(20) NOT NULL DEFAULT 'parent-child',
        "confidence" decimal(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        "detected_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_interest_hierarchies_parent_id"
          FOREIGN KEY ("parent_id")
          REFERENCES "user_interests"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_interest_hierarchies_child_id"
          FOREIGN KEY ("child_id")
          REFERENCES "user_interests"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_interest_hierarchies_no_self_reference"
          CHECK ("parent_id" != "child_id"),
        CONSTRAINT "UQ_interest_hierarchies_pair"
          UNIQUE ("parent_id", "child_id")
      )
    `);

    // Create indexes for interest_hierarchies
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_hierarchies_parent_id"
      ON "interest_hierarchies" ("parent_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_hierarchies_child_id"
      ON "interest_hierarchies" ("child_id")
    `);

    // Create interest_recommendations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interest_recommendations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source_interest_id" uuid NOT NULL,
        "recommended_topic" varchar(255) NOT NULL,
        "recommendation_score" decimal(5, 4) NOT NULL CHECK (recommendation_score >= 0 AND recommendation_score <= 1),
        "reasoning" text,
        "co_occurrence_score" decimal(5, 4) DEFAULT 0,
        "semantic_score" decimal(5, 4) DEFAULT 0,
        "hierarchy_score" decimal(5, 4) DEFAULT 0,
        "temporal_score" decimal(5, 4) DEFAULT 0,
        "computed_at" timestamp NOT NULL DEFAULT NOW(),
        "expires_at" timestamp,
        CONSTRAINT "FK_interest_recommendations_source_interest_id"
          FOREIGN KEY ("source_interest_id")
          REFERENCES "user_interests"("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_interest_recommendations_source_topic"
          UNIQUE ("source_interest_id", "recommended_topic")
      )
    `);

    // Create indexes for interest_recommendations
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_recommendations_source_interest_id"
      ON "interest_recommendations" ("source_interest_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_recommendations_recommendation_score"
      ON "interest_recommendations" ("recommendation_score" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interest_recommendations_expires_at"
      ON "interest_recommendations" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop interest_recommendations table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_recommendations_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_recommendations_recommendation_score"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_recommendations_source_interest_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interest_recommendations"`);

    // Drop interest_hierarchies table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_hierarchies_child_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_hierarchies_parent_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interest_hierarchies"`);

    // Drop interest_similarities table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_similarities_similarity_score"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_similarities_interest_2_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_similarities_interest_1_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interest_similarities"`);

    // Drop interest_embeddings table and indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_embeddings_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interest_embeddings_interest_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interest_embeddings"`);

    // Drop new columns from user_interests
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_interests_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_interests_merged_into_id"`);

    await queryRunner.query(`
      ALTER TABLE "user_interests"
      DROP CONSTRAINT IF EXISTS "FK_user_interests_merged_into_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_interests"
      DROP COLUMN IF EXISTS "is_active",
      DROP COLUMN IF EXISTS "synonyms",
      DROP COLUMN IF EXISTS "merged_into_id"
    `);
  }
}
