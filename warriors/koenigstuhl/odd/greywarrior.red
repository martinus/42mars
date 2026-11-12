;redcode-94
;name Grey Warrior
;author Hurkyl
;assert 1

org     scan

inc:    dat     162, 162
bomb:   dat     0, 81
        add.f   inc, scan
        mov bomb, @scan
scan:   sne     81, @81 - 2723
        jmp -3
        mov inc, }scan
        jmp -1
