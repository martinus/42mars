;redcode-94x
;name Pendulum X
;author John Metcalf
;strategy .75c scanner
;assert CORESIZE==55440

        step   equ 13
        ptr    equ (inc-step)

bomb    spl    #0,         {0

wipe    mov    @last,      <ptr
        mov    >ptr,       >ptr
        jmn.f  wipe,       >ptr

reset   mov.ab ptr,        ptr

scan    sub    inc,        ptr
        sne.x  *ptr,       @ptr
inc     sub.x  #-2*step,   ptr
        jmz.f  scan,       @ptr

        slt    ptr,        #last+4-ptr
        djn    wipe,       ptr
        djn    reset,      #13
last    djn.f  reset,      #bomb

        end    reset

