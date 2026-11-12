;redcode-94x
;name Pointer-Patcher
;author Sascha Zapf
;strategy Second entry irct No.10
;assert 1

endless spl     $0,$-20
        spl     $0,$760
        spl     $0,$0
inkr    spl     $20,$20
        spl     $0,$0
        spl     $0,$0
loop    add.f   inkr,<endless
        djn.b   loop,   endless+1
        jmp     endless

        end     loop
