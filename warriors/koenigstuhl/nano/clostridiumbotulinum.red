;redcode-nano verbose
;name Clostridium Botulinum
;author Fluffy
;strategy Don't eat me!
;assert CORESIZE == 80

        ORG     start

start   spl.x  # 32, > 52
        mov.i  $ 77, { 77
        mov.i  > 56, < 42
        djn.i  $ 78, < 41

        END

