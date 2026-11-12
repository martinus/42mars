;redcode-94x
;name Burning Skin
;author Lukasz Adamowski
;strategy IRCT10
;assert 1

begin   jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        djn.a   $0,     }begin-1
        djn.b   $0,     }begin-2
        djn.f   $0,     <begin-3
start   djn.f   $0,     {begin-4
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start
        jmp     start

        end     start
