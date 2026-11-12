;redcode-94x
;name Nemesis
;author John Metcalf
;strategy hydra/paper/imp
;assert CORESIZE==55440

        spl    paper

        first  equ 17068
        step   equ 32705

tspl    spl    #39231,       <boot
        mov.i  #1,           <boot
boot    mov    tdjn,         first
        add    #step,        boot
        mov    tspl,         @boot
        djn.f  @boot,        {tspl
tdjn    djn    -2,           #22510

        for    176
        dat    0,0
        rof

        step1    equ 39710
        step2    equ 43810
        istep    equ 29179        ; istep = (19^-1) mod 55440

paper   spl    2                  ; 10 parallel processes
        spl    2
        spl    1
        spl    1

        mov    <pboot,   {pboot
pboot   jmp    30000,    papera+10

papera  spl    step1
        mov    >papera,  }papera
paperb  spl    step2
        mov    >paperb,  }paperb
        spl    1,        <13860

inc     spl    #istep,   -3       ; vortex launcher
        add    inc,      launch
launch  djn.f  imp-istep*20,<27720

        dat    0,0

imp     mov.i  #istep,   *0

        end 

