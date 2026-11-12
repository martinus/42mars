;redcode-94x
;name rice clear
;author Simon Wainwright
;strategy stargate clear RF10
;assert 1
;       CORESIZE==800

gate    dat       squash,       40
aimp    dat         <534,     <267
squash  spl   #aimp-gate,        7 
clear   mov        *gate,    >gate
        djn.f      clear, gate+267
        end       squash
