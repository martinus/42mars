;redcode-94x
;name Wanderer
;author Jakub Kozisek
;strategy scanner
;       CORESIZE==800
;assert 1

off     equ     (loop-20)

        org     loop+1

loop    sub.f   inc,         ptr
        sne.f   *ptr,        @ptr
        djn.f   loop,        @ptr
        djn.f   clear,       ptr

for 10
        dat     0,           0
rof

inc     dat     6,           6
ptr     dat     off,         400-off
        spl     1,           1
clear   spl     @0,          0
        djn.f   last,        {ptr
last    djn.f   clear+1,     <ptr
