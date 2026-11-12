;redcode-94x
;name OoS stripped
;author Sascha
;assert CORESIZE==8000 || CORESIZE==800

step  equ 80
first equ 141
dist  equ 3022
time  equ 285


ptr:    sne   first,    first+dist
        add   db,       ptr
p:      mov   bomb,     }ptr
        mov   bomb,     >ptr
        djn   @p,       #time

bomb:   mov   db,       >ptr
        djn.f -1,       >ptr
db:     dat   step-1,   step-1
        end
