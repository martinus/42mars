;redcode-94x
;name The Enemy Within
;author John Metcalf
;strategy paper/stone
;assert CORESIZE==55440

         spos   equ 1000
         ppos   equ spos-20874

warr     spl    2,        <2000     ; 6 parallel processes
         spl    1,        <2100
         spl    1,        <2200

         mov    <sfrom,   {sboot
sboot    spl    spos,     <2300
         spl    *sboot,   <2400
         spl    *sboot,   <2500
         spl    *sboot,   <2600
         mov    {papera,  {pboot
pboot    djn.f  ppos,     <4000

         step1  equ -336
         step2  equ -15352
         step3  equ 17152

papera   spl    @papera+6,{step1
         mov    }papera,  >papera
paperb   spl    @paperb,  >step2
         mov    }paperb,  >paperb
         mov    {paperb,  <paperc
paperc   djn.f  @paperc,  >step3

         gap    equ -12
         sstep  equ 7256

sfrom    spl    #0,       stone+5
stone    mov    dbmb,     <hit-sstep
hit      mov    dbmb,     @stone
         sub    #sstep,   @hit
         djn.f  stone,    <-3000
dbmb     dat    <1,       <gap+1
         end

