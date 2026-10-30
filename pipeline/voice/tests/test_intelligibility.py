"""Word error rate used by the intelligibility measurement (the recognizer itself is not run in tests)."""
from pipeline.voice.intelligibility import word_error_rate, words


def test_words_ignore_case_accents_and_punctuation():
    assert words("¡Siempre te recordaré!") == ["siempre", "te", "recordare"]
    assert words("Descansa, lo estás haciendo bien.") == ["descansa", "lo", "estas", "haciendo", "bien"]


def test_word_error_rate():
    assert word_error_rate("sigue así", "Sigue así.") == 0.0
    assert word_error_rate("también te extraño", "también extraño") == 1 / 3  # one deletion
    assert word_error_rate("gracias", "muchas gracias") == 1.0  # one insertion
    assert word_error_rate("siempre te recordaré", "siempre te recuerda") == 1 / 3  # one substitution
    assert word_error_rate("gracias", "") == 1.0
