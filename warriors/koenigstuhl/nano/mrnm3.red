;redcode-nano
;name Machines Rule No More III
;author Neogryzor/FatalC
;strategy qscan
;assert 1

a equ qs-18
b equ qs-12
c equ qs+12

qs:     sne.i  a,    b
bmb:    mov.i  #c,   -1
        mov    bmb,  }qs
        mov    {-10, }qs
        djn.f  -2,   }qs
end qs
