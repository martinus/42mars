;redcode-94
;name Pendulum-4009
;author John Metcalf
;strategy .75c scanner
;assert CORESIZE==8000

        step   equ 4009
        ptr    equ (inc-2*step)

bomb    spl    #0,         {0

wipe    mov    @last,      <ptr
        mov    >ptr,       >ptr
        jmn.f  wipe,       >ptr

reset   mov.ab ptr,        ptr

scan    sub.x  inc,        ptr
        sne.x  *ptr,       @ptr
inc     sub.f  #-step,     ptr
        jmz.f  scan,       @ptr

        slt    ptr,        #last+4-ptr
        djn    wipe,       ptr
        djn    reset,      #17
last    djn.f  reset,      #bomb

        end    reset

