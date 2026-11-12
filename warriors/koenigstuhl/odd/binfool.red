;redcode
;name BinFool
;author Philip Thorne
;assert CORESIZE==8000

        spl     1
        spl     1
        add.f   $1,     $1
        spl     #1,     1
        mov.i   *-1,    >-1
        add.ab  #1,     @-1
        jmp     @-1,    1
    for 16-4
        dat     0,      0
    rof
bmb:    dat     1,      1
end
