;redcode-94x
;name OoS.F ;-)
;author John Metcalf
;strategy IRCT10
;       CORESIZE==800
;assert 1

        step  equ 13
        first equ 40
        dist  equ 204
        time  equ 42

ptr:    sne.f first,    first+dist
        add.f db,       ptr
p:      mov.f db,       }ptr
        mov.f db,       >ptr
        djn   @p,       ti

ti:     spl   }0,       {time
        mov.f db,       >ptr
        djn.f -1,       >ptr
db:     dat   {step-1,   {step-1
        end


