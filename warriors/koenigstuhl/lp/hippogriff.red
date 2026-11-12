i;redcode-lp
;name Hippogriff
;author John Metcalf
;strategy looping paper
;assert CORESIZE==8000

; trying to find a decent looping paper
; with each improvement it looks more like Digital Rain 

        sstep  equ 2407
        pstep  equ 7569

paper   mov    #28,      #28
copy    mov    }5096,    sstep
        add    inc,      copy
        mov    <paper,   {dest
        jmn    copy,     paper
inc     spl    >paper,   }sstep
dest    jmz    @pstep,   *0

        end    copy

