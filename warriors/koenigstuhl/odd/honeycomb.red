;redcode
;name Honeycomb
;author S.Fernandes
;strategy paper
;assert 1

        org     paper

sdista  equ     6108
sdistb  equ     1802
bdist   equ     -100

paper   spl     1           ,    {200
        spl     1           ,    {2000
        spl     1           ,    {13860

silka   spl     @0          ,    }sdista
        mov     }silka      ,    >silka
silkb   spl     @0          ,    }sdistb
clear   mov     }silkb      ,    >silkb
        mov     bomb        ,    <1+bdist
        djn.f   clear       ,    <bdist

bomb    mov.i   #1          ,    -2
        dat     1           ,    1
        end
