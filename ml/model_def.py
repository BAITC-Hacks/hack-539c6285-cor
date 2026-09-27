"""Определение модели — единственный источник топологии.

build_model(keras) принимает МОДУЛЬ keras (keras 3 для тренировки,
tf_keras для конверсии в TF.js) и строит идентичную функциональную модель.
Все слои имеют явные имена — веса переносятся между сборками по имени.
Только слои, гарантированно конвертируемые в tfjs layers-format:
никаких MHA/EinsumDense/Lambda/SeparableConv.
"""
T = 60
F = 319  # 259 канонизация + 60 реляционных (features.py append_relational)
NUM_CLASSES = 1001
ACT = "swish"  # день-1 smoke-тест проверяет поддержку в tfjs; фолбэк relu


def build_model(keras, activation: str = ACT, num_classes: int = NUM_CLASSES,
                num_features: int = F):
    L = keras.layers
    inp = L.Input(shape=(T, num_features), name="frames")

    # стем
    x = L.Conv1D(256, 5, padding="same", use_bias=False, name="conv_stem")(inp)
    x = L.BatchNormalization(name="bn_stem")(x)
    x = L.Activation(activation, name="act_stem")(x)
    x = L.SpatialDropout1D(0.1, name="sdrop_stem")(x)

    # резидуальный блок
    y = L.Conv1D(256, 5, padding="same", use_bias=False, name="conv_a")(x)
    y = L.BatchNormalization(name="bn_a")(y)
    y = L.Activation(activation, name="act_a")(y)
    y = L.Conv1D(256, 5, padding="same", use_bias=False, name="conv_b")(y)
    y = L.BatchNormalization(name="bn_b")(y)
    x = L.Add(name="res_add")([x, y])
    x = L.Activation(activation, name="act_res")(x)
    x = L.SpatialDropout1D(0.15, name="sdrop_res")(x)

    x = L.MaxPooling1D(2, name="pool")(x)  # (30,256)

    x = L.Conv1D(384, 3, padding="same", use_bias=False, name="conv_c")(x)
    x = L.BatchNormalization(name="bn_c")(x)
    x = L.Activation(activation, name="act_c")(x)
    x = L.SpatialDropout1D(0.15, name="sdrop_c")(x)

    x = L.Bidirectional(L.LSTM(224, return_sequences=True), name="bilstm_1")(x)
    x = L.Dropout(0.2, name="drop_lstm")(x)
    x = L.Bidirectional(L.LSTM(160, return_sequences=True), name="bilstm_2")(x)

    avg = L.GlobalAveragePooling1D(name="gap")(x)
    mx = L.GlobalMaxPooling1D(name="gmp")(x)
    x = L.Concatenate(name="pool_cat")([avg, mx])

    x = L.Dropout(0.4, name="drop_head1")(x)
    x = L.Dense(512, activation=activation, name="head_dense")(x)
    x = L.Dropout(0.3, name="drop_head2")(x)
    logits = L.Dense(num_classes, name="logits")(x)
    out = L.Softmax(name="probs")(logits)

    return keras.Model(inp, out, name="rsl_recognizer")


if __name__ == "__main__":
    import keras
    m = build_model(keras)
    m.summary()
