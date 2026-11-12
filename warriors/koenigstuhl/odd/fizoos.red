;redcode-94x
;name fizOoS
;author Christian Schmidt
;strategy JM's Scanner
;strategy IRC #13 Entry
;assert 1


        step  equ 13
        first equ 40+5
        dist  equ 1268;204
        time  equ 43

ptr:    sne   first,    first+dist
        add   db,       ptr
p:      mov   bomb,     }ptr
        mov   bomb,     >ptr
        djn   @p,       #time

bomb:   spl   #1,       1
        mov   db,       >ptr
        djn.f -1,       >ptr
db:     dat   step-1,   step-1
        end


