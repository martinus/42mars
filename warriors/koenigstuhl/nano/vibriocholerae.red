;redcode-nano verbose
;name Vibrio cholerae
;author Fluffy
;strategy Are you out of tetracycline?
;assert CORESIZE == 80

        ORG start

        dat.f  } 40, < 50
start   spl.b  # 46, > 30
        mov.i  < 79, { 79
        mov.i  > 10, { 71
        djn.f  $ 78, < 54

        END

