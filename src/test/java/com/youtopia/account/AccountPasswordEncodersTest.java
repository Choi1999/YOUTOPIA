package com.youtopia.account;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AccountPasswordEncodersTest {
    @Test void versionedSaltedEncodingVerifiesActualPasswordAndRejectsWrongPassword() {
        var encoder = AccountPasswordEncoders.create();
        String fake = "가짜 테스트 암호 with unicode 1234";
        String first = encoder.encode(fake);
        String second = encoder.encode(fake);
        assertThat(first).startsWith("{pbkdf2-sha256-v1}").doesNotContain(fake).isNotEqualTo(second);
        assertThat(encoder.matches(fake, first)).isTrue();
        assertThat(encoder.matches("wrong synthetic password", first)).isFalse();
        assertThat(encoder.matches(fake, second)).isTrue();
    }

    @Test void unrecognizedStoredFormatCannotFallBackToPlaintextOrOtherHash() {
        var encoder = AccountPasswordEncoders.create();
        assertThat(encoder.matches("synthetic", "synthetic")).isFalse();
        assertThat(encoder.matches("synthetic", "{noop}synthetic")).isFalse();
        assertThat(encoder.matches("synthetic", "{unknown}synthetic")).isFalse();
    }
}
