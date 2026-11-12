;redcode-94
;name Black Warrior
;author Hurkyl
;assert 1

org     scan

inc:    dat     81, 81
        add.f   inc, scan
scan:   sne     81, 81 - 2723
        jmp -2
        mov inc, }scan
        jmp -1
