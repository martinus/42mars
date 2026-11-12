;redcode-tiny
;name desTiny
;author Sascha Zapf
;assert CORESIZE==800
;strategy qbomb -> silkdwarf
;strategy Soft as Silk reworked/reoptimized

;optimax 1234
;optimax work tinytest

;optimax rounds 1 50 200 500

;optimax suite fshtiny0.1
;optimax alarm highscore
;optimax phase2 fshtiny0.1/clr/T766.RED
;optimax phase2 120


;optimax phase3 130
;optimax phase3 top10
;optimax phase3 pap:cds

;optimax phase4 100%
;optimax phase4 top10

start
        mov.i <428, 542
        mov.i <701, 40
        mov.i <688, 481
        mov.i <125, 327
        mov.i <683, 556
        mov.i <231, 378
        mov.i <367, 261
        mov.i <439, 84
        mov.i <642, 69

bootdis equ 187

launch  spl     2, <696
        spl     1, <598
        spl     1, <620
        mov.i   {ssilk,{boot
boot    djn.f   launch+bootdis,<219

ssilk   spl     @6,<104
        mov.i   }-1,    >-1
        spl     #374,   >272 
        mov     {560,   {160
        add     -2,     -1
        djn.f @0, {-2

        end     start
